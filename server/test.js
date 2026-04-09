const fs = require('fs');
const path = require('path');

async function testUpload() {
  const form = new FormData();
  // Create a dummy blob
  const fileContent = new Blob(['Hello World!'], { type: 'text/plain' });
  form.append('file', fileContent, 'test.txt');
  form.append('studentId', '00000000-0000-0000-0000-000000000000');

  try {
    const res = await fetch('http://localhost:8000/api/lms/submissions/upload', {
      method: 'POST',
      body: form
    });
    console.log(res.status);
    const json = await res.json();
    console.log(json);
  } catch (err) {
    console.log("Fetch error:", err);
  }
}
testUpload();
