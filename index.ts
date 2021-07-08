import { createApp } from './app';
const port = process.env.PORT || 3000;

const app = createApp({});

app.listen(port, (err, add) => {
    if (err) {
        console.error('Failed to start');
    }
    console.log(`Fastify is now listening on ${add}`);
})