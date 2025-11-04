
let currentSubjectId = null;

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  if (id === 'mark-attendance') loadSubjectsForAttendance();
  if (id === 'subjects') {
    document.getElementById('syllabus-view').style.display = 'none';
    document.getElementById('subjects-list').style.display = 'block';
    loadAllSubjects();
  }
  if (id === 'meetings') loadMeetings();
}

function addSubject() {
  const name = document.getElementById('sub-name').value.trim();
  const division = document.getElementById('sub-div').value.trim().toUpperCase();
  if (!name || !division) return alert('Please enter subject name and division');
  
  fetch('/lecturer/subject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, division })
  })
  .then(r => r.json())
  .then(d => {
    alert(d.message || 'Subject added!');
    document.getElementById('sub-name').value = '';
    document.getElementById('sub-div').value = '';
    loadAllSubjects();
  })
  .catch(() => alert('Network error'));
}

function loadAllSubjects() {
  fetch('/lecturer/subjects')
    .then(r => r.json())
    .then(subs => {
      const container = document.getElementById('subjects-list');
      container.innerHTML = subs.length ? subs.map(s => `
        <div class="subject-card" onclick="showSyllabus(${s.id}, '${s.name.replace(/'/g, "\\'")}', '${s.division}')">
          <strong>${s.name}</strong> - Div ${s.division}
        </div>
      `).join('') : '<p style="color:#666;">No subjects added yet.</p>';
    })
    .catch(() => container.innerHTML = '<p style="color:red;">Error loading subjects</p>');
}

function showSyllabus(id, name, division) {
  currentSubjectId = id;
  document.getElementById('subjects-list').style.display = 'none';
  const view = document.getElementById('syllabus-view');
  view.style.display = 'block';
  view.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
      <button onclick="showSection('subjects')" style="background:#004080;color:white;padding:8px 16px;border:none;border-radius:20px;font-size:0.9em;cursor:pointer;">
        ← Back
      </button>
      <h3 style="margin:0;">${name} - Div ${division}</h3>
    </div>
    <div style="background:white;padding:20px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      <div style="display:flex; gap:10px; margin-bottom:15px;">
        <input id="unit-num" placeholder="Unit" style="width:90px;padding:10px;border:1px solid #ddd;border-radius:8px;">
        <input id="unit-content" placeholder="Unit Content" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;">
        <button onclick="saveUnit(${id})" style="background:#004080;color:white;padding:10px 20px;border:none;border-radius:20px;cursor:pointer;">
          Add Unit
        </button>
      </div>
      <div id="units-list"></div>
    </div>
  `;
  loadUnits(id);
}

function loadUnits(id) {
  fetch(`/lecturer/syllabus/${id}`)
    .then(r => r.json())
    .then(units => {
      const list = document.getElementById('units-list');
      list.innerHTML = units.length ? units.map(u => `
        <div class="subject-unit">
          <strong style="color:#004080;">Unit ${u.unit}:</strong> ${u.content}
        </div>
      `).join('') : '<p style="color:#888; font-style:italic;">No units added yet.</p>';
    })
    .catch(() => list.innerHTML = '<p style="color:red;">Error loading units</p>');
}

function saveUnit(id) {
  const unit = document.getElementById('unit-num').value.trim();
  const content = document.getElementById('unit-content').value.trim();
  if (!unit || !content) return alert('Fill both');
  
  fetch('/lecturer/syllabus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject_id: id, unit, content })
  })
  .then(() => {
    document.getElementById('unit-num').value = '';
    document.getElementById('unit-content').value = '';
    loadUnits(id);  // ← REFRESH UNITS
    alert('Unit added!');
  })
  .catch(() => alert('Error'));
}

// MARK ATTENDANCE
// ... (keep showSection, addSubject)

function loadAllSubjects() {
  fetch('/lecturer/subjects')
    .then(r => r.json())
    .then(allSubs => {
      // Group by name
      const unique = {};
      allSubs.forEach(s => unique[s.name] = unique[s.name] || { id: s.id, name: s.name, divisions: [] });
      allSubs.forEach(s => unique[s.name].divisions.push(s.division));
      
      document.getElementById('subjects-list').innerHTML = Object.values(unique).map(sub => `
        <div class="subject-card" onclick="openSubject('${sub.name}', [${sub.divisions.map(d => `'${d}'`).join(',')}])">
          <strong>${sub.name}</strong>
        </div>
      `).join('') || '<p>No subjects</p>';
    });
}

function openSubject(name, divisions) {
  document.getElementById('subjects-list').style.display = 'none';
  document.getElementById('syllabus-view').style.display = 'block';
  document.getElementById('syllabus-view').innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
      <button onclick="showSection('subjects')" class="back-btn">← Back</button>
      <h3>${name}</h3>
    </div>
    <select id="div-select" style="padding:10px; border-radius:8px; margin-bottom:15px;">
      <option>Select Division</option>
      ${divisions.map(d => `<option>${d}</option>`).join('')}
    </select>
    <div id="syllabus-content"></div>
  `;
  
  document.getElementById('div-select').onchange = function() {
    const div = this.value;
    if (!div) return;
    // Find subject ID for this division
    fetch('/lecturer/subjects').then(r => r.json()).then(subs => {
      const subj = subs.find(s => s.name === name && s.division === div);
      if (subj) showSyllabusEditor(subj.id, name, div);
    });
  };
}

function showSyllabusEditor(id, name, division) {
  currentSubjectId = id;
  document.getElementById('syllabus-content').innerHTML = `
    <div style="background:white;padding:20px;border-radius:12px;">
      <div style="display:flex; gap:10px; margin-bottom:15px;">
        <input id="unit-num" placeholder="Unit" style="width:90px;">
        <input id="unit-content" placeholder="Content" style="flex:1;">
        <button onclick="saveUnit(${id})">Add Unit</button>
      </div>
      <div id="units-list"></div>
    </div>
  `;
  loadUnits(id);
}

// MARK ATTENDANCE - SAME FIX
function loadSubjectsForAttendance() {
  fetch('/lecturer/subjects')
    .then(r => r.json())
    .then(allSubs => {
      const unique = {};
      allSubs.forEach(s => unique[s.name] = unique[s.name] || { name: s.name, divisions: [] });
      allSubs.forEach(s => unique[s.name].divisions.push(s.division));
      
      document.getElementById('subject-list').innerHTML = Object.values(unique).map(sub => `
        <div class="subject-card" onclick="selectDivForAttendance('${sub.name}', [${sub.divisions.map(d => `'${d}'`).join(',')}])">
          <strong>${sub.name}</strong>
        </div>
      `).join('');
    });
}

function selectDivForAttendance(name, divisions) {
  document.getElementById('subject-list').innerHTML = `
    <div id="attendance-mark">
      <h3>${name}</h3>
      <select id="div-select-att" style="padding:10px; margin:15px 0; width:100%; border-radius:8px;">
        <option>Select Division</option>
        ${divisions.map(d => `<option>${d}</option>`).join('')}
      </select>
      <input type="date" id="att-date" style="width:100%; padding:10px; margin:10px 0; border-radius:8px;">
      <div id="students-list"></div>
      <button onclick="startAttendance('${name}')" style="margin-top:15px;">Next</button>
    </div>
  `;
  
  document.getElementById('div-select-att').onchange = function() {
    const div = this.value;
    if (!div) return;
    fetch('/lecturer/subjects').then(r => r.json()).then(subs => {
      const subj = subs.find(s => s.name === name && s.division === div);
      if (subj) loadStudentsForDiv(subj.id);
    });
  };
}

function loadStudentsForDiv(subjectId) {
  const div = document.getElementById('div-select-att').value;
  fetch(`/lecturer/division/${div}/students`).then(r => r.json()).then(stus => {
    document.getElementById('students-list').innerHTML = stus.map(s => `
      <div class="attendance-row">
        <input type="checkbox" value="${s.id}" checked>
        <label><strong>${s.roll_no}</strong> ${s.prn}</label>
      </div>
    `).join('');
    document.querySelector('#attendance-mark button').onclick = () => markAttendance(subjectId);
  });
}

function startAttendance(name) {
}
// MEETINGS
function loadMeetings() {
  fetch('/lecturer/meetings').then(r => r.json()).then(meets => {
    document.getElementById('meetings-list').innerHTML = meets.length ? meets.map(m => `
      <div style="background:white;padding:15px;margin:10px 0;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <strong>${m.prn}</strong>: ${m.reason}<br>
        <small>Status: <strong style="color:${m.status==='approved'?'green':m.status==='rejected'?'red':'orange'}">${m.status.toUpperCase()}</strong></small>
        ${m.status === 'pending' ? `
          <div style="margin-top:10px;">
            <button onclick="updateMeeting(${m.id}, 'approved')" style="background:green;color:white;padding:6px 12px;border:none;border-radius:20px;margin-right:8px;">Approve</button>
            <button onclick="updateMeeting(${m.id}, 'rejected')" style="background:red;color:white;padding:6px 12px;border:none;border-radius:20px;">Reject</button>
          </div>
        ` : m.date_time ? `<br><small>Scheduled: ${m.date_time}</small>` : ''}
      </div>
    `).join('') : '<p style="color:#666;">No meeting requests.</p>';
  });
}

function updateMeeting(id, status) {
  let dt = null;
  if (status === 'approved') {
    dt = prompt('Enter Date & Time (YYYY-MM-DD HH:MM):');
    if (!dt) return;
  }
  fetch(`/lecturer/meeting/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, date_time: dt })
  })
  .then(() => loadMeetings());
}

// Auto-load on start
showSection('subjects');