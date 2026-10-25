/* Generuje quiz-content.js z quiz-content.json: node build-content-js.js
   Strona wczytuje treść przez <script>, więc działa też otwarta prosto z dysku (file://), gdzie fetch jest blokowany. */
const fs = require('fs');
const c = fs.readFileSync(__dirname + '/quiz-content.json', 'utf8');
JSON.parse(c);
fs.writeFileSync(__dirname + '/quiz-content.js', '/* Wygenerowane z quiz-content.json (node build-content-js.js). Nie edytuj ręcznie. */\nwindow.QUIZ_CONTENT = ' + c.trim() + ';\n');
console.log('OK: quiz-content.js');
