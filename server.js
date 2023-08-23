const http = require('http');
const Koa = require('koa');
const { koaBody  } = require('koa-body');
const uuid = require('uuid');
const app = new Koa();
const Router = require('koa-router');
const router = new Router();
const moment = require('moment');
const WS = require('ws');

//CORS
app.use(async (ctx, next) => {
    const origin = ctx.request.get('Origin');
    if (!origin) {
        return await next();
    }
    const headers = { 'Access-Control-Allow-Origin': '*', };

    if (ctx.request.method !== 'OPTIONS') {
        ctx.response.set({ ...headers });
        try {
            return await next();
        } catch (e) {
            e.headers = { ...e.headers, ...headers };
            throw e;
        }
    }

    if (ctx.request.get('Access-Control-Request-Method')) {
        ctx.response.set({
            ...headers,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
        });

        if (ctx.request.get('Access-Control-Request-Headers')) {
            ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
        }
        ctx.response.status = 204;
    }
});
//
app.use(koaBody ({
    multipart: true,
    urlencoded: true,
    formidable: {
        uploadDir: './public/uploads', // директория для сохранения загруженных файлов
        keepExtensions: true,    // сохранять расширения файлов
    }
}));
let nicknames = [];
let messagesStory = [];
const clients = new Set();
function onConnect(wsClient) {
    // отправка приветственного сообщения клиенту
    wsClient.send('Привет от сервера')




    let nickname = null;
    clients.add(wsClient);
    console.log(`Новый пользователь.`);


    wsClient.on('message', function(message) {
        console.log(`Сообщение от клиента - ${message}`);
            const data = JSON.parse(message);
            if(data.hasOwnProperty('nickname')) {
                const res = nicknames.find((item) => item === data.nickname);
                if (res !== undefined) {
                    console.log('ошибка, такой пользователь уже существует')
                    wsClient.send(JSON.stringify({status: 'failed', message: 'Никнейм занят, придумайте другой'}));
                } else {
                    nicknames.push(data.nickname);
                    nickname = data.nickname;
                    wsClient.send(JSON.stringify({allMessages: messagesStory}));
                    wsClient.send(JSON.stringify({
                        status: 'success',
                        nickname: nickname,
                        message: 'Никнейм свободен, пользователь успешно создан'
                    }));

                    console.log(nicknames);
                    clients.forEach((client) => {
                        client.send(JSON.stringify({chatMembers: nicknames}));
                    })
                }
            }
            if(data.hasOwnProperty('message')){
                console.log(`new message from ${nickname}`);
                const sender = nickname;
                const time = moment().format('DD.MM.YYYY hh:mm');
                const content = data.message;
                const message = {sender: sender, time: time, messageText: content};
                messagesStory.push(message);
                clients.forEach((client) => {
                    client.send(JSON.stringify(message));
                });
            }
    });


    wsClient.on('close', function() {
        // отправка уведомления в консоль
        console.log(`Пользователь ${nickname} отключился`);
        nicknames = nicknames.filter((item) => item!==nickname);
        clients.forEach((client) => {
            client.send(JSON.stringify({chatMembers: nicknames}));
        })
    });
}

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server });
wsServer.on('connection', onConnect);
server.listen(port);
