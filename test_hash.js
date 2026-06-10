const bcrypt = require('bcrypt');

const hash = '$2b$10$/kg7vzGQ347zxSOyVFI75OoDZErMQ8oiSeqgHfs8SgxnOswADPGi6';
const tests = ['password', '123456', '12345678', 'password123', 'admin', 'rahasia', 'aldo', 'aldo123'];

async function testPasswords() {
    for (const p of tests) {
        const match = await bcrypt.compare(p, hash);
        if (match) {
            console.log("Matched:", p);
            return;
        }
    }
    console.log("No match found");
}

testPasswords();
