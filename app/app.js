
    // Firebase configuration
// Replace these placeholder values with your own Firebase project configuration.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db   = firebase.firestore();

    // ===== 2) Service worker (PWA)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js');
    }

    // ===== 3) FirebaseUI setup
 var ui = new firebaseui.auth.AuthUI(auth);

    // Example authorized users for portfolio demonstration
const allowedEmails = [
  "user1@example.com",
  "user2@example.com",
  "user3@example.com"
];

   auth.onAuthStateChanged(async user => {
  console.log('auth state changed; user =', user);

  if (user) {
    // 🔐 FRONTEND CHECK: is this email allowed?
    if (!allowedEmails.includes(user.email)) {
      alert("Sorry, this account is not authorized to use the scheduler.");
      auth.signOut();
      return;
    }

    $('#authContainer').hide();
    $('#app').show();
    $('#btnSignOut').show();
    $('#userInfo').text(user.email);
    $('#userLabel').text(user.email);

     if (!$('#weekStart').val()) {
    $('#weekStart').val(getMonday(new Date()));
}
    if (!$('#shiftDate').val()) {
  $('#shiftDate').val(ymd(new Date()));
}

    await loadPeople();
          loadWeek();
  } else {
    $('#app').hide();
    $('#btnSignOut').hide();
    $('#authContainer').show();

  ui.start('#firebaseui-auth-container', {
  signInFlow: 'popup',  // 👈 add this back
  signInOptions: [
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
  ],
  callbacks: {
    signInSuccessWithAuthResult: () => false
  }
});

  }
});


    $('#btnSignOut').on('click', () => auth.signOut());

    // ===== Helpers
    function ymd(d){
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    }

    function getMonday(d) {
      const date = new Date(d);
      const day = (date.getDay()+6)%7; // Monday=0
      date.setDate(date.getDate()-day);
      return ymd(date);
    }

    function addDays(iso, n){
      const d = new Date(iso+"T00:00:00");
      d.setDate(d.getDate()+n);
      return ymd(d);
    }

         function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

async function loadPeople() {
  const snap = await db.collection('employees').get();

  const people = [];

  snap.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      people.push(data.name.trim());
    }
  });

  people.sort((a, b) => a.localeCompare(b));

  const $select = $('#person');
  $select.empty();

  people.forEach(name => {
    $select.append(`<option>${name}</option>`);
  });

}

    // ===== CRUD
    let currentEditId = null;

    async function loadWeek(){
      const start = $('#weekStart').val();
      if (!start) return;
      const end   = addDays(start, 7); // exclusive

      const snap = await db.collection('shifts')
        .where('date','>=', start)
        .where('date','<',  end)
        .orderBy('date','asc')
        .orderBy('person','asc')
        .get();

      const $tb = $('#tbody').empty();
      const totals = {};
      snap.forEach(doc=>{
        const s = doc.data();
        const shiftHours = ((timeToMinutes(s.end) - timeToMinutes(s.start)) / 60).toFixed(1);

        let personBadge = '';

        if (s.person === 'Alora') {
            personBadge = '<span class="chip">Alora</span>';
        } else if (s.person === 'Sam') {
            personBadge = '<span class="chip">Sam</span>';
        } else if (s.person === 'Jess') {
  personBadge = '<span class="chip">Jess</span>';
}

if (!totals[s.person]) {
  totals[s.person] = 0;
}
totals[s.person] += Number(shiftHours);
        const $tr = $(`
            <tr data-id="${doc.id}">
           <td>${s.date}</td>
            <td>${personBadge}</td>
            <td>${s.start}</td>
           <td>${s.end}</td>
          <td>${shiftHours}</td>
      <td class="text-right">
      <button class="btn-delete" title="Delete">🗑️</button>
    </td>
  </tr>
`);
        // click row to load for editing
        $tr.on('click', (e)=>{
          if ($(e.target).hasClass('btn-delete')) return;
          currentEditId = doc.id;
          $('#shiftDate').val(s.date);
          $('#person').val(s.person);
          $('#startTime').val(s.start);
          $('#endTime').val(s.end);
          $('#btnSave').text('Update shift');
        });
        // delete
        $tr.find('.btn-delete').on('click', async ()=>{
          await db.collection('shifts').doc(doc.id).delete();
          if (currentEditId === doc.id){ resetForm(); }
          loadWeek();
        });
        $tb.append($tr);
      });
     let summaryText = '';

for (const person in totals) {
  summaryText += `${person}: ${totals[person]} hrs | `;
}

// remove last separator
summaryText = summaryText.replace(/ \| $/, '');

$('#hoursSummary').html(summaryText);
    }

    async function saveShift(){
      const user = auth.currentUser;
      const payload = {
        date:  $('#shiftDate').val(),
        person:$('#person').val(),
        start: $('#startTime').val(),
        end:   $('#endTime').val(),
        createdBy: user ? user.uid : null
      };
      if (!payload.date){ alert('Pick a date'); return; }
      if (!payload.start || !payload.end){ alert('Start/End required'); 
        return; 
      }

      if (timeToMinutes(payload.end) <= timeToMinutes(payload.start)) {
      alert('End time must be after start time');
        return;
       }

      if (currentEditId){
        await db.collection('shifts').doc(currentEditId).update(payload);
      } else {
        await db.collection('shifts').add(payload);
      }
        resetForm();
        loadPeople();
        loadWeek();
    }

    function resetForm(){
      currentEditId = null;
      $('#btnSave').text('Save shift');
    }

    function printSchedule() {
  window.print();
}

    // UI events
    $('#btnSave').on('click', saveShift);
    $('#weekStart').on('change', loadWeek);
    $('#btnPrint').on('click', printSchedule);

// month view

let currentCalendarDate = new Date();

function firstDayOfMonth(date) {
  return ymd(new Date(date.getFullYear(), date.getMonth(), 1));
}

function firstDayOfNextMonth(date) {
  return ymd(new Date(date.getFullYear(), date.getMonth() + 1, 1));
}

async function loadMonth() {
  const start = firstDayOfMonth(currentCalendarDate);
  const end = firstDayOfNextMonth(currentCalendarDate);

  const snap = await db.collection('shifts')
    .where('date', '>=', start)
    .where('date', '<', end)
    .orderBy('date', 'asc')
    .orderBy('person', 'asc')
    .get();

  const shifts = [];

  snap.forEach(doc => {
    shifts.push({
      id: doc.id,
      ...doc.data()
    });
  });

  renderMonthlyCalendar(shifts);
}

function renderMonthlyCalendar(shifts) {
  const calendarGrid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('calendarMonthLabel');

  calendarGrid.innerHTML = '';

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  monthLabel.textContent = currentCalendarDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();

  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.classList.add('calendar-day', 'empty');
    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dayCell = document.createElement('div');
    dayCell.classList.add('calendar-day');

    const dayNumber = document.createElement('div');
    dayNumber.classList.add('day-number');
    dayNumber.textContent = day;
    dayCell.appendChild(dayNumber);

    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;


    const today = ymd(new Date());

if (dateString === today) {
  dayCell.style.border = "2px solid #2E1B28";
}

  dayCell.addEventListener('click', () => {
  $('#shiftDate').val(dateString);
  $('#weekStart').val(getMonday(new Date(dateString + "T00:00:00")));
  $('#weekView').show();
  $('#monthView').hide();
  loadWeek();
});

    const dayShifts = shifts.filter(shift => shift.date === dateString);

   dayShifts.slice(0, 3).forEach(s => {
      const shiftDiv = document.createElement('div');
      shiftDiv.classList.add('calendar-event');
      shiftDiv.textContent = `${s.person}: ${s.start}-${s.end}`;
      dayCell.appendChild(shiftDiv);
    });

    if (dayShifts.length > 3) {
  const more = document.createElement('div');
  more.classList.add('calendar-event');
  more.textContent = `+${dayShifts.length - 3} more`;
  dayCell.appendChild(more);
}

    calendarGrid.appendChild(dayCell);
  }
}

$('#btnWeekView').on('click', () => {
  $('#weekView').show();
  $('#monthView').hide();
});

$('#btnMonthView').on('click', () => {
  $('#weekView').hide();
  $('#monthView').show();
  loadMonth();
});

$('#prevMonthBtn').on('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  loadMonth();
});

$('#nextMonthBtn').on('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  loadMonth();
});