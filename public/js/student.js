


let syllabusData = [];

// SHOW SECTION
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  
  if (id === 'attendance') loadAttendance();
  if (id === 'subjects') loadSyllabus();
  if (id === 'meeting') loadMeetingForm();
  // if (id === 'quiz') loadQuizGenerator();
}

// --- ATTENDANCE ---
function loadAttendance() {
  const el = document.getElementById('att-list');
  el.innerHTML = '<p>Loading...</p>';
  fetch('/student/attendance')
    .then(r => r.json())
    .then(data => {
      if (!data.length) {
        el.innerHTML = '<p>No attendance recorded yet.</p>';
        return;
      }
      let html = '<table style="width:100%; border-collapse:collapse;"><tr><th>Subject</th><th>Date</th><th>Status</th></tr>';
      data.forEach(r => {
        html += `<tr><td>${r.subject}</td><td>${r.date}</td><td style="color:green;font-weight:bold;">${r.status}</td></tr>`;
      });
      el.innerHTML = html + '</table>';
    })
    .catch(() => el.innerHTML = '<p style="color:red;">Error loading attendance</p>');
}

// --- SYLLABUS ---
function loadSyllabus() {
  fetch('/student/syllabus')
    .then(r => r.json())
    .then(data => {
      const groups = {};
      data.forEach(d => {
        groups[d.name] = groups[d.name] || [];
        groups[d.name].push(d);
      });

      const container = document.getElementById('subjects-list');
      container.innerHTML = Object.keys(groups).length ? 
        Object.keys(groups).map(name => `
          <div class="subject-card" onclick="toggleUnits('units-${name.replace(/ /g,'')}')">
            <strong>${name}</strong>
          </div>
          <div id="units-${name.replace(/ /g,'')}" style="display:none; padding:15px; background:#f8f9fc; border-radius:10px; margin:10px 0;">
            ${groups[name].map(u => `
              <div class="subject-unit">
                <strong style="color:#004080;">Unit ${u.unit}:</strong><br>
                ${u.content}
              </div>
            `).join('')}
          </div>
        `).join('') 
        : '<p style="color:#666; text-align:center; padding:20px;">No syllabus available yet.</p>';
    })
    .catch(() => {
      document.getElementById('subjects-list').innerHTML = '<p style="color:red;">Error loading syllabus</p>';
    });
}

function toggleUnits(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// --- MEETING ---
function loadMeetingForm() {
  const container = document.getElementById('meeting-form');
  container.innerHTML = '<p>Loading lecturers...</p>';

  fetch('/student/lecturers')
    .then(r => r.json())
    .then(lects => {
      container.innerHTML = `
        <select id="lec-select" style="width:100%; padding:12px; margin:10px 0; border-radius:8px;">
          <option value="">Select Lecturer</option>
          ${lects.map(l => `<option value="${l.id}">${l.email}</option>`).join('')}
        </select>
        <input id="reason" placeholder="Reason for meeting" style="width:100%; padding:12px; margin:10px 0; border-radius:8px;">
        <button onclick="sendMeeting()" style="width:100%; padding:14px; background:#004080; color:white; border:none; border-radius:20px;">
          Send Request
        </button>
        <div id="my-meetings" style="margin-top:20px;"></div>
      `;
      loadMyMeetings();
    });
}

function sendMeeting() {
  const lecId = document.getElementById('lec-select').value;
  const reason = document.getElementById('reason').value.trim();
  if (!lecId || !reason) return alert('Select lecturer and write reason');
  fetch('/student/meeting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lecturer_id: lecId, reason })
  })
  .then(r => r.json())
  .then(d => {
    alert(d.message || d.error);
    document.getElementById('reason').value = '';
    loadMyMeetings();
  });
}

function loadMyMeetings() {
  fetch('/student/meetings')
    .then(r => r.json())
    .then(meets => {
      document.getElementById('my-meetings').innerHTML = meets.length ? `
        <h4>My Requests</h4>
        ${meets.map(m => `
          <div style="background:#f0f8ff; padding:12px; margin:8px 0; border-radius:8px; border-left:4px solid #004080;">
            <strong>Lecturer:</strong> ${m.lecturer_email}<br>
            <strong>Reason:</strong> ${m.reason}<br>
            <strong>Status:</strong> 
            <span style="color:${m.status==='approved'?'green':m.status==='rejected'?'red':'orange'}">
              ${m.status.toUpperCase()}
            </span>
            ${m.date_time ? `<br><strong>Scheduled:</strong> ${m.date_time}` : ''}
          </div>
        `).join('')}
      ` : '<p>No meeting requests sent.</p>';
    });
}

// // --- QUIZ GENERATOR (FIXED) ---
// function loadQuizGenerator() {
//   const form = document.getElementById('quiz-form');
//   form.innerHTML = '<p style="text-align:center;color:#004080;">Loading syllabus...</p>';

//   fetch('/student/syllabus')
//     .then(r => r.json())
//     .then(data => {
//       syllabusData = data;
//       if (!data.length) {
//         form.innerHTML = '<p style="color:#666;text-align:center;">No syllabus added yet.</p>';
//         return;
//       }

//       const subjects = [...new Set(data.map(d => d.name))];

//       form.innerHTML = `
//         <div style="background:white;padding:25px;border-radius:15px;box-shadow:0 4px 12px rgba(0,0,0,0.1);max-width:600px;margin:0 auto;">
//           <h3 style="text-align:center;color:#004080;margin-top:0;">AI Quiz Generator</h3>
//           <select id="quiz-subject" style="width:100%;padding:14px;margin:12px 0;border-radius:10px;border:1px solid #ddd;font-size:1em;">
//             <option value="">Select Subject</option>
//             ${subjects.map(s => `<option>${s}</option>`).join('')}
//           </select>
//           <div id="unit-wrapper" style="display:none;">
//             <select id="quiz-unit" style="width:100%;padding:14px;margin:12px 0;border-radius:10px;border:1px solid #ddd;font-size:1em;">
//               <option value="">Select Unit</option>
//             </select>
//           </div>
//           <button id="generate-btn" disabled style="width:100%;padding:16px;background:#ccc;color:white;border:none;border-radius:25px;font-size:1.1em;cursor:not-allowed;">
//             Generate Quiz
//           </button>
//           <div id="quiz-result" style="margin-top:20px;padding:20px;background:#f8f9fc;border-radius:12px;display:none;"></div>
//         </div>
//       `;

//       document.getElementById('quiz-subject').onchange = function() {
//         const sub = this.value;
//         const units = data.filter(d => d.name === sub).map(d => d.unit);
//         const unitSelect = document.getElementById('quiz-unit');
//         unitSelect.innerHTML = '<option value="">Select Unit</option>' + units.map(u => `<option>${u}</option>`).join('');
//         document.getElementById('unit-wrapper').style.display = units.length ? 'block' : 'none';
//         updateGenerateButton();
//       };

//       document.getElementById('quiz-unit').onchange = updateGenerateButton;
//       document.getElementById('generate-btn').onclick = generateQuiz;
//     })
//     .catch(() => {
//       form.innerHTML = '<p style="color:red;text-align:center;">Failed to load. Check internet.</p>';
//     });
// }

// function updateGenerateButton() {
//   const subject = document.getElementById('quiz-subject')?.value;
//   const unit = document.getElementById('quiz-unit')?.value;
//   const btn = document.getElementById('generate-btn');
//   const enabled = subject && unit;
//   btn.disabled = !enabled;
//   btn.style.background = enabled ? '#004080' : '#ccc';
//   btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
//   btn.innerHTML = enabled ? 'Generate Quiz' : 'Select Subject & Unit';
// }

// function generateQuiz() {
//   const subject = document.getElementById('quiz-subject').value;
//   const unit = document.getElementById('quiz-unit').value;
//   const content = syllabusData.find(d => d.name === subject && d.unit === unit)?.content || '';

//   if (!content) return alert('Unit content not found!');

//   const btn = document.getElementById('generate-btn');
//   btn.innerHTML = 'Generating...';
//   btn.disabled = true;

//   fetch('/generate-quiz', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ topic: `${subject} - Unit ${unit}: ${content.substring(0, 3000)}` })
//   })
//   .then(r => r.json())
//   .then(res => {
//     document.getElementById('quiz-result').innerHTML = `
//       <h4 style="color:#004080;">Quiz: ${subject} - Unit ${unit}</h4>
//       <pre style="white-space:pre-wrap;background:white;padding:20px;border-radius:10px;border:1px solid #eee;">${res.quiz}</pre>
//       <button onclick="document.getElementById('quiz-result').style.display='none'; loadQuizGenerator();" 
//               style="margin-top:10px;padding:10px 20px;background:#004080;color:white;border:none;border-radius:20px;">
//         New Quiz
//       </button>
//     `;
//     document.getElementById('quiz-result').style.display = 'block';
//     btn.innerHTML = 'Generate Quiz';
//     btn.disabled = false;
//     btn.style.background = '#004080';
//   })
//   .catch(() => {
//     alert('Quiz failed. Check OpenAI key.');
//     btn.innerHTML = 'Generate Quiz';
//     btn.disabled = false;
//   });
// }

// AUTO LOAD
showSection('attendance');