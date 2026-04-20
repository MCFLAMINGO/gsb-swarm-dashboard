import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * Inbox Watcher — LocalIntel Autonomous Data Pipeline
 *
 * Runs every 6 hours via Vercel Cron.
 * Checks Gmail for CSV responses from government public records senders.
 * When found: downloads attachment, POSTs CSV to Railway DataIngestWorker.
 * Logs each run to ingestWatcherLog (in-memory, visible in response).
 *
 * Known senders watched:
 *   - DOS_Sunbiz@dos.myflorida.com       (FL Sunbiz bulk CSV)
 *   - publicrecords@sjctax.us            (SJC BTR business licenses)
 *   - info@sjcpa.us                      (SJC Property Appraiser)
 *   - Any @dos.myflorida.com reply
 *   - Any @sjctax.us reply
 *   - Any @sjcpa.us reply
 */

const RAILWAY_INGEST = 'https://gsb-swarm-production.up.railway.app/api/local-intel/ingest';

const WATCHED_SENDERS = [
  { domain: 'dos.myflorida.com', source: 'sunbiz' },
  { domain: 'sjctax.us',         source: 'sjc_btr' },
  { domain: 'sjcpa.us',          source: 'sjc_pao' },
  { domain: 'myflorida.com',     source: 'sunbiz' },
  { domain: 'stjohnsfl.us',      source: 'sjc_generic' },
  { domain: 'sjcfl.us',          source: 'sjc_generic' },
];

// ── Call external-tool CLI ────────────────────────────────────────────────────
function callTool(sourceId: string, toolName: string, args: Record<string, unknown>) {
  const params = JSON.stringify({ source_id: sourceId, tool_name: toolName, arguments: args });
  const escaped = params.replace(/'/g, "'\"'\"'");
  const result = execSync(`external-tool call '${escaped}'`, {
    timeout: 30000,
    env: { ...process.env },
  }).toString();
  return JSON.parse(result);
}

function getSenderDomain(from: string): string {
  const match = from.match(/@([\w.-]+)/);
  return match ? match[1].toLowerCase() : '';
}

function detectSource(from: string): string {
  const domain = getSenderDomain(from);
  const match = WATCHED_SENDERS.find(s => domain.includes(s.domain));
  return match?.source || 'generic';
}

function isWatchedSender(from: string): boolean {
  const domain = getSenderDomain(from);
  return WATCHED_SENDERS.some(s => domain.includes(s.domain));
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const log: string[] = [];
  const results: Record<string, unknown> = {};
  let emailsChecked = 0;
  let attachmentsFound = 0;
  let datasetsIngested = 0;

  log.push(`[${new Date().toISOString()}] Inbox watcher started`);

  try {
    // ── Step 1: Search Gmail for replies from watched senders ──────────────────
    // Search for emails in last 7 days from any watched domain with attachments
    const searchQueries = [
      'from:dos.myflorida.com has:attachment',
      'from:sjctax.us has:attachment',
      'from:sjcpa.us has:attachment',
      'from:sjcfl.us has:attachment',
      // Also catch any reply to our original requests
      'subject:"Public Records Request" has:attachment newer_than:7d',
    ];

    const allEmails: Array<{
      id: string;
      from: string;
      subject: string;
      date: string;
      snippet: string;
      attachments?: Array<{ filename: string; mime_type: string; attachment_id: string }>;
    }> = [];

    for (const query of searchQueries) {
      try {
        const searchResult = callTool('gcal', 'search_email', {
          queries: [query],
          max_results: 10,
        });

        // Parse result — search_email returns JSON string
        let emails: typeof allEmails = [];
        if (typeof searchResult === 'string') {
          emails = JSON.parse(searchResult);
        } else if (searchResult?.result) {
          const parsed = typeof searchResult.result === 'string'
            ? JSON.parse(searchResult.result)
            : searchResult.result;
          emails = parsed?.emails || parsed?.messages || [];
        }

        for (const email of emails) {
          // Dedupe by id
          if (!allEmails.find(e => e.id === email.id)) {
            allEmails.push(email);
          }
        }
      } catch (e) {
        log.push(`  Search error for "${query}": ${e instanceof Error ? e.message : e}`);
      }
    }

    emailsChecked = allEmails.length;
    log.push(`Found ${emailsChecked} candidate emails`);

    // ── Step 2: Filter to watched senders only ─────────────────────────────────
    const relevantEmails = allEmails.filter(e => isWatchedSender(e.from || ''));
    log.push(`Relevant (watched senders): ${relevantEmails.length}`);

    // ── Step 3: Process each email with CSV attachment ─────────────────────────
    for (const email of relevantEmails) {
      const source = detectSource(email.from || '');
      log.push(`Processing: "${email.subject}" from ${email.from} (source: ${source})`);

      const attachments = email.attachments || [];
      const csvAttachments = attachments.filter(a =>
        a.filename?.toLowerCase().endsWith('.csv') ||
        a.filename?.toLowerCase().endsWith('.txt') ||
        a.mime_type?.includes('csv') ||
        a.mime_type?.includes('text/plain')
      );

      if (!csvAttachments.length) {
        log.push(`  No CSV attachments in this email`);
        continue;
      }

      attachmentsFound += csvAttachments.length;

      for (const attachment of csvAttachments) {
        log.push(`  Processing attachment: ${attachment.filename}`);

        try {
          // Download attachment content via search_email with attachment_id
          const attachResult = callTool('gcal', 'search_email', {
            queries: [`rfc822msgid:${email.id}`],
            include_attachments: true,
            attachment_id: attachment.attachment_id,
          });

          let csvText = '';
          if (typeof attachResult === 'string') {
            csvText = attachResult;
          } else if (attachResult?.result) {
            const parsed = typeof attachResult.result === 'string'
              ? JSON.parse(attachResult.result)
              : attachResult.result;
            csvText = parsed?.attachment_content || parsed?.content || '';
          }

          if (!csvText || csvText.length < 50) {
            log.push(`  Could not retrieve attachment content`);
            continue;
          }

          // ── Step 4: POST to Railway DataIngestWorker ─────────────────────────
          log.push(`  POSTing ${csvText.length} chars to Railway ingest...`);

          const ingestRes = await fetch(RAILWAY_INGEST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source,
              csv_text:  csvText,
              filename:  attachment.filename,
              sender:    email.from,
              email_id:  email.id,
              email_subject: email.subject,
            }),
          });

          const ingestData = await ingestRes.json() as {
            ok: boolean;
            added?: number;
            merged?: number;
            total_dataset?: number;
            error?: string;
          };

          if (ingestData.ok) {
            datasetsIngested++;
            log.push(`  ✓ Ingested: +${ingestData.added} added, ${ingestData.merged} merged → ${ingestData.total_dataset} total`);
            results[attachment.filename] = {
              status: 'ingested',
              source,
              added: ingestData.added,
              merged: ingestData.merged,
              total: ingestData.total_dataset,
            };
          } else {
            log.push(`  ✗ Ingest failed: ${ingestData.error}`);
            results[attachment.filename] = { status: 'failed', error: ingestData.error };
          }
        } catch (e) {
          log.push(`  Error processing attachment: ${e instanceof Error ? e.message : e}`);
        }
      }
    }

  } catch (e) {
    log.push(`Fatal error: ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Unknown error',
      log,
    }, { status: 500 });
  }

  log.push(`Done. Checked: ${emailsChecked} emails, attachments: ${attachmentsFound}, ingested: ${datasetsIngested}`);

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    emails_checked:    emailsChecked,
    attachments_found: attachmentsFound,
    datasets_ingested: datasetsIngested,
    results,
    log,
  });
}
