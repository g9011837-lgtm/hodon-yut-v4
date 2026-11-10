// Existing multiplayer integration fixtures run several clients on localhost.
// Production `npm start` does not load this file. Single-IP tests explicitly enable enforcement.
if(process.env.HODON_SINGLE_IP_LIMIT===undefined)process.env.HODON_SINGLE_IP_LIMIT='0';
