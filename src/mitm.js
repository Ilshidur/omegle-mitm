import closeWithGrace from 'close-with-grace';
import exitHook from 'exit-hook';
import onExit from 'signal-exit';
import Connection from './connection.js';

// const conn1 = new Connection();
// const conn2 = new Connection();

// conn1.on('connected', async () => {
//     console.log('1: Connected !');
// });
// conn1.on('typing', async () => {
//     console.log('1: (typing)');
//     await conn2.typing();
// });
// conn1.on('gotMessage', async ([message]) => {
//     console.log('1:', message);
//     await conn2.send(message);
// });
// conn1.on('strangerDisconnected', async () => {
//     console.log('1: Stranger disconnected.');

//     await conn2.disconnect();
//     await conn2.connect();
//     await conn1.connect();
// });

// conn2.on('connected', async () => {
//     console.log('2: Connected !');
// });
// conn2.on('typing', async () => {
//     console.log('2: (typing)');
//     await conn1.typing();
// });
// conn2.on('gotMessage', async ([message]) => {
//     console.log('2:', message);
//     await conn1.send(message);
// });
// conn2.on('strangerDisconnected', async () => {
//     console.log('2: Stranger disconnected.');
    
//     await conn1.disconnect();
//     await conn1.connect();
//     await conn2.connect();
// });

// (async () => {
//     try {
//         await conn1.connect([]);
//         await conn2.connect([]);
//     } catch (error) {
//         console.error(error.data || error);
//     } finally {
//         // TODO: Clear.
//         // await conn1.disconnect();
//     }
// })();

const conn1 = new Connection([], true);

conn1.on('waiting', async () => {
    console.log('Waiting...');
});
conn1.on('connected', async () => {
    console.log('Connected !');
});
conn1.on('typing', async () => {
    console.log('(typing)');
});
conn1.on('gotMessage', async ([message]) => {
    console.log('1:', message);
});
conn1.on('strangerDisconnected', async () => {
    console.log('Stranger disconnected.');
});
conn1.on('error', (error) => {
    console.error(error);
});

(async () => {
    try {
        console.log('Connecting...');
        await conn1.connect();
    } catch (error) {
        console.error(error.data || error);
    }
})();
