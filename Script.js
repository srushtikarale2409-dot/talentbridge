/* =========================================================
   TalentBridge — shared front-end logic
   Data layer: browser localStorage, acting as a tiny CRM (leads)
   and HRM (candidates) database. No backend required for the
   prototype — swap `Store` for real API calls when you're ready.
   ========================================================= */

const Store = {
  LEADS_KEY: 'tb_leads',
  CANDIDATES_KEY: 'tb_candidates',

  _read(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      return [];
    }
  },
  _write(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  },

  getLeads() { return this._read(this.LEADS_KEY); },
  addLead(lead) {
    const leads = this.getLeads();
    lead.id = 'L' + Date.now();
    lead.createdAt = new Date().toISOString();
    lead.status = lead.status || 'New';
    leads.unshift(lead);
    this._write(this.LEADS_KEY, leads);
    return lead;
  },
  updateLeadStatus(id, status) {
    const leads = this.getLeads().map(l => l.id === id ? { ...l, status } : l);
    this._write(this.LEADS_KEY, leads);
  },
  deleteLead(id) {
    this._write(this.LEADS_KEY, this.getLeads().filter(l => l.id !== id));
  },

  getCandidates() { return this._read(this.CANDIDATES_KEY); },
  addCandidate(c) {
    const list = this.getCandidates();
    c.id = 'C' + Date.now();
    c.createdAt = new Date().toISOString();
    c.status = c.status || 'Applied';
    list.unshift(c);
    this._write(this.CANDIDATES_KEY, list);
    return c;
  },
  updateCandidateStatus(id, status) {
    const list = this.getCandidates().map(c => c.id === id ? { ...c, status } : c);
    this._write(this.CANDIDATES_KEY, list);
  },
  deleteCandidate(id) {
    this._write(this.CANDIDATES_KEY, this.getCandidates().filter(c => c.id !== id));
  }
};

/* ---------------- Toast ---------------- */
function showToast(message, duration = 3200) {
  let toast = document.getElementById('tb-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tb-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ---------------- Call & WhatsApp ----------------
   Two modes are supported:

   1. FALLBACK (works with zero setup): opens the visitor's own phone
      dialer pre-filled with your number. This is what happens if the
      backend below isn't running — the site still works, it just
      can't make YOUR phone ring automatically.

   2. REAL CLICK-TO-CALL (requires server.js + Twilio, see .env.example):
      asks the visitor for their number, sends it to /api/click-to-call,
      which makes Twilio ring YOUR phone first. The moment you answer,
      Twilio dials the visitor and joins both calls. This is the only
      way a website can make an actual phone ring — browsers cannot
      place phone calls directly. */
const AGENCY_PHONE = '+919999999999';   // <-- replace with your real number
const AGENCY_WHATSAPP = '919999999999'; // <-- digits only, country code, no +
const USE_REAL_CLICK_TO_CALL = true;   // <-- set true once server.js is deployed and running

function callNow(source = 'unknown') {
  if (USE_REAL_CLICK_TO_CALL) {
    openCallbackModal(source);
    return;
  }
  Store.addLead({
    company: '(Call button)',
    contact: '-',
    email: '-',
    role: '-',
    openings: '-',
    message: `Visitor tapped Call Now from "${source}" section.`,
    channel: 'Call'
  });
  showToast('Opening your phone dialer to call our team…');
  window.location.href = `tel:${AGENCY_PHONE}`;
}

function openCallbackModal(source) {
  let modal = document.getElementById('callback-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'callback-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <button class="modal-close" onclick="document.getElementById('callback-modal').classList.remove('open')" aria-label="Close">×</button>
        <h3>Request a call back</h3>
        <p>Enter your number and our team's phone will ring immediately — when they pick up, you'll be connected.</p>
        <form id="callback-form">
          <div class="field"><label>Your phone number</label><input name="phone" type="tel" placeholder="+91XXXXXXXXXX" required></div>
          <button type="submit" class="btn btn-primary btn-block">Call me now</button>
        </form>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('callback-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const phone = e.target.phone.value.trim();
      submitClickToCall(phone, source);
      modal.classList.remove('open');
    });
  }
  modal.classList.add('open');
}

async function submitClickToCall(phone, source) {
  showToast('Calling our team now — stay near your phone…');
  Store.addLead({
    company: '(Callback request)',
    contact: phone,
    email: '-',
    role: '-',
    openings: '-',
    message: `Visitor requested a callback from "${source}" section.`,
    channel: 'Call'
  });
  try {
    const res = await fetch('/api/click-to-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    showToast('Connected! Our team is calling you shortly.');
  } catch (err) {
    showToast("Couldn't reach the call service. Please try WhatsApp instead.");
  }
}

function openWhatsApp(source = 'unknown', prefill = '') {
  Store.addLead({
    company: '(WhatsApp button)',
    contact: '-',
    email: '-',
    role: '-',
    openings: '-',
    message: `Visitor opened WhatsApp from "${source}" section.`,
    channel: 'WhatsApp'
  });
  const text = encodeURIComponent(prefill || "Hi TalentBridge, I'd like help with hiring / a job opening.");
  window.open(`https://wa.me/${AGENCY_WHATSAPP}?text=${text}`, '_blank');
}

/* ---------------- Mobile nav ---------------- */
function toggleMobileNav() {
  document.querySelector('.nav-links')?.classList.toggle('open-mobile');
}

/* ---------------- Employer requirement form ---------------- */
function handleEmployerForm(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    company: form.company.value.trim(),
    contact: form.contact.value.trim(),
    email: form.email.value.trim(),
    role: form.role.value.trim(),
    openings: form.openings.value.trim(),
    message: form.message.value.trim(),
    channel: 'Web form'
  };
  if (!data.company || !data.email || !data.role) {
    showToast('Please fill in company, email and role.');
    return;
  }
  Store.addLead(data);
  form.reset();
  showToast(`Thanks ${data.company}! Our team will reach out within 24 hours.`);
}

/* ---------------- Candidate registration form ---------------- */
function handleCandidateForm(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    roleApplied: form.roleApplied.value.trim(),
    experience: form.experience.value.trim(),
    skills: form.skills.value.trim()
  };
  if (!data.name || !data.phone || !data.roleApplied) {
    showToast('Please fill in name, phone and the role you want.');
    return;
  }
  Store.addCandidate(data);
  form.reset();
  showToast(`Thanks ${data.name}! Your profile has been added to our talent pool.`);
}

/* ---------------- Jobs data + rendering ---------------- */
const JOBS = [
  { title: 'Warehouse Supervisor', location: 'Bhiwandi, MH', type: 'Full-time', openings: 4, tag: 'Urgent' },
  { title: 'React Frontend Developer', location: 'Remote (India)', type: 'Full-time', openings: 2, tag: 'IT' },
  { title: 'Field Sales Executive', location: 'Pune, MH', type: 'Full-time', openings: 10, tag: 'Bulk hiring' },
  { title: 'HR Executive', location: 'Mumbai, MH', type: 'Full-time', openings: 1, tag: '' },
  { title: 'CNC Machine Operator', location: 'Aurangabad, MH', type: 'Contract', openings: 6, tag: 'Urgent' },
  { title: 'Customer Support Associate', location: 'Thane, MH', type: 'Full-time', openings: 8, tag: 'Bulk hiring' }
];

function renderJobs() {
  const wrap = document.getElementById('jobs-list');
  if (!wrap) return;
  wrap.innerHTML = JOBS.map((job, i) => `
    <div class="job-card">
      <div>
        <div class="job-title">${job.title} ${job.tag ? `<span class="job-tag">${job.tag}</span>` : ''}</div>
        <div class="job-meta">
          <span>${iconPin()} ${job.location}</span>
          <span>${iconClock()} ${job.type}</span>
          <span>${iconUsers()} ${job.openings} opening${job.openings > 1 ? 's' : ''}</span>
        </div>
      </div>
      <button class="btn btn-dark" onclick="openApplyModal(${i})">Apply now</button>
    </div>
  `).join('');
}

function iconPin() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>'; }
function iconClock() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'; }
function iconUsers() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'; }

/* ---------------- Apply modal (links job interest to candidate form) ---------------- */
function openApplyModal(jobIndex) {
  const job = JOBS[jobIndex];
  document.getElementById('apply-job-title').textContent = job.title;
  document.getElementById('modal-role-field').value = job.title;
  document.getElementById('apply-modal').classList.add('open');
}
function closeApplyModal() {
  document.getElementById('apply-modal').classList.remove('open');
}

/* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  renderJobs();
  document.getElementById('employer-form')?.addEventListener('submit', handleEmployerForm);
  document.getElementById('candidate-form')?.addEventListener('submit', handleCandidateForm);
  document.getElementById('modal-candidate-form')?.addEventListener('submit', (e) => {
    handleCandidateForm(e);
    closeApplyModal();
  });
});