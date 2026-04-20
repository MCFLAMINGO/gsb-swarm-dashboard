'use client';

import { useState } from 'react';
import Link from 'next/link';

const CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant / Cafe / Bar' },
  { value: 'fast_food', label: 'Fast Food' },
  { value: 'supermarket', label: 'Grocery / Supermarket' },
  { value: 'retail', label: 'Retail Shop' },
  { value: 'clothes', label: 'Clothing' },
  { value: 'hairdresser', label: 'Salon / Barber' },
  { value: 'beauty', label: 'Spa / Beauty' },
  { value: 'fitness_centre', label: 'Gym / Fitness' },
  { value: 'dentist', label: 'Dentist' },
  { value: 'clinic', label: 'Medical / Clinic' },
  { value: 'veterinary', label: 'Veterinary' },
  { value: 'bank', label: 'Bank / Credit Union' },
  { value: 'estate_agent', label: 'Real Estate' },
  { value: 'school', label: 'School / Academy' },
  { value: 'place_of_worship', label: 'Church / Place of Worship' },
  { value: 'fuel', label: 'Gas Station' },
  { value: 'car_wash', label: 'Car Wash' },
  { value: 'office', label: 'Professional Office' },
  { value: 'other', label: 'Other' },
];

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://gsb-swarm-production.up.railway.app';

export default function ClaimPage() {
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: 'Ponte Vedra Beach',
    zip: '32082',
    category: 'restaurant',
    phone: '',
    website: '',
    hours: '',
    notes: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<string>('');
  const [osmQueue, setOsmQueue] = useState<number | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setResult('');
    try {
      const res = await fetch(`${BACKEND}/api/local-intel/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus('success');
        setResult(`Business added to the Local Intel dataset. OSM queue: ${data.osmQueued ?? 0} pending.`);
        // Refresh OSM queue count
        fetchOsmQueue();
      } else {
        setStatus('error');
        setResult(data.error || 'Submission failed.');
      }
    } catch (err: unknown) {
      setStatus('error');
      setResult(err instanceof Error ? err.message : 'Network error — try again.');
    }
  }

  async function fetchOsmQueue() {
    try {
      const res = await fetch(`${BACKEND}/api/local-intel/osm-queue`);
      const data = await res.json();
      setOsmQueue(data.count ?? 0);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/local-intel" className="text-[#00ff88] text-sm hover:underline">← Local Intel</Link>
        <h1 className="text-3xl font-bold mt-3 mb-1">Claim Your Business</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Add your business to the agent-readable Local Intel dataset — the open alternative to Google Maps.
          Verified listings are geocoded, added to our dataset instantly, and queued for OpenStreetMap submission.
        </p>
      </div>

      {/* Why section */}
      <div className="bg-[#111118] border border-[#1a1a2e] rounded-xl p-5 mb-8">
        <h2 className="text-[#00ff88] font-semibold text-sm uppercase tracking-wider mb-3">Why this matters</h2>
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex gap-3">
            <span className="text-[#00ff88] mt-0.5">▸</span>
            <span><strong className="text-white">Google controls your visibility.</strong> We give you a direct channel to AI-powered discovery.</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[#00ff88] mt-0.5">▸</span>
            <span><strong className="text-white">Owner-verified data</strong> gets confidence score 100 — highest priority in any agent query.</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[#00ff88] mt-0.5">▸</span>
            <span><strong className="text-white">OpenStreetMap submission</strong> means your business appears in Apple Maps, DuckDuckGo, and hundreds of AI apps that don't use Google.</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[#00ff88] mt-0.5">▸</span>
            <span><strong className="text-white">Free forever.</strong> No ads, no pay-to-rank, no algorithm games.</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Business Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="e.g. McFlamingo"
            className="w-full bg-[#111118] border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00ff88] transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Street Address *</label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              required
              placeholder="e.g. 880 A1A N Suite 12"
              className="w-full bg-[#111118] border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00ff88] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">City</label>
            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              className="w-full bg-[#111118] border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00ff88] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">ZIP Code *</label>
            <select
              name="zip"
              value={form.zip}
              onChange={handleChange}
              required
              className="w-full bg-[#111118] border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00ff88] transition-colors"
            >
              <option value="32082">32082 — Ponte Vedra Beach</option>
              <option value="32081">32081 — Nocatee</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Category *</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            required
            className="w-full bg-[#111118] border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00ff88] transition-colors"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="(904) 000-0000"
              className="w-full bg-[#111118] border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00ff88] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Website</label>
            <input
              name="website"
              value={form.website}
              onChange={handleChange}
              placeholder="https://yourbusiness.com"
              className="w-full bg-[#111118] border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00ff88] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Hours</label>
          <input
            name="hours"
            value={form.hours}
            onChange={handleChange}
            placeholder="e.g. Mo-Sa 11:00-20:00; Su 11:00-18:00"
            className="w-full bg-[#111118] border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00ff88] transition-colors"
          />
          <p className="text-xs text-gray-600 mt-1">OSM format: Mo-Fr 09:00-17:00; Sa-Su closed</p>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Notes (optional)</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            placeholder="Anything else agents should know about your business..."
            className="w-full bg-[#111118] border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00ff88] transition-colors resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-[#00ff88] text-black font-bold py-3 rounded-lg text-sm uppercase tracking-wider hover:bg-[#00cc6a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Submitting...' : 'Add My Business to the Dataset'}
        </button>
      </form>

      {/* Result */}
      {status === 'success' && (
        <div className="mt-5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-xl p-4 text-[#00ff88] text-sm">
          ✓ {result}
        </div>
      )}
      {status === 'error' && (
        <div className="mt-5 bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-400 text-sm">
          ✗ {result}
        </div>
      )}

      {/* OSM Queue Status */}
      <div className="mt-8 border-t border-[#1a1a2e] pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider">OSM Submission Queue</h3>
          <button
            onClick={fetchOsmQueue}
            className="text-xs text-[#00ff88] hover:underline"
          >
            Check status
          </button>
        </div>
        {osmQueue === null ? (
          <p className="text-gray-600 text-xs">Click "Check status" to see how many listings are pending OSM submission.</p>
        ) : (
          <div className="bg-[#111118] border border-[#1a1a2e] rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{osmQueue}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {osmQueue === 0
                ? 'Queue empty — all submissions processed'
                : `${osmQueue} listing${osmQueue === 1 ? '' : 's'} queued for OSM OAuth submission`}
            </div>
          </div>
        )}
        <p className="text-xs text-gray-600 mt-3 leading-relaxed">
          OSM submissions require OAuth authentication. Verified listings are queued automatically
          and submitted in batches. Once live on OpenStreetMap, your business appears in Apple Maps,
          DuckDuckGo, and all AI apps using the OSM graph.
        </p>
      </div>
    </div>
  );
}
