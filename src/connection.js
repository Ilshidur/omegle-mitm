import axios from 'axios';
import Canvas from 'canvas';
import EventEmitter from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import WebRTC from 'wrtc';

const TOKEN_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const randomToken = (length) => Array(length).fill().map(() => TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)]).join('');

const STUN_SERVERS = ['stun:stun.l.google.com:19302'];
const CAMERA = 'Logitech BRIO (046d:085e)';

class Connection extends EventEmitter {
    constructor(topics, video = false) {
        super();
        this.state = 'disconnected';
        this.clientID = undefined;
        this.topics = topics || [];
        this.video = video;
        this.axios = axios.create({
            baseURL: 'https://front10.omegle.com', // TODO: Use http://front1.omegle.com/status to use a random server.
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip,deflate',
                'Accept-Language': 'en-US;q=0.6,en;q=0.4',
                Connection: 'keep-alive',
                DNT: '1',
                Host: 'omegle.com',
                Origin: 'http://www.omegle.com',
                Referer: 'http://www.omegle.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36',
            },
            timeout: 1000 * 60 * 30, // 30 minutes, for long polling.
        });

        this.peerConnection = undefined;
        this.gotRtcCall = false;
        this.answersQueue = [];

        this.on('waiting', async () => {
            await this.getEvents();
        });

        this.on('connected', async () => {
            this.state = 'connected';
            await this.getEvents();
        });

        this.on('rtccall', async () => {
            this.gotRtcCall = true;
            console.log('Got rtccall');
            try {
                await this.initPeerConnection();
            } catch(err) {
                this.emit('error', err);
            }
        });

        this.on('rtcpeerdescription', async (answer) => {
            console.log('Got rtcpeerdescription.', answer);
            console.log('this.peerConnection', this.peerConnection);

            if (!this.peerConnection) {
                // Save for later.
                this.answersQueue.push(answer);
                return;
            }

            console.log('this.peerConnection.currentRemoteDescription', this.peerConnection.currentRemoteDescription);

            if (!this.peerConnection.currentRemoteDescription) {
                const session = new WebRTC.RTCSessionDescription(answer);
                await this.peerConnection.setRemoteDescription(session);

                console.log('this.gotRtcCall', this.gotRtcCall);
                console.log('Creating answer...');
                const sessionDescription = await this.peerConnection.createAnswer({
                    mandatory: {
                        OfferToReceiveAudio: false, // TODO: true
                        OfferToReceiveVideo: true,
                    },
                });
                await this.peerConnection.setLocalDescription(sessionDescription);
                await this.rtcPeerConnection(sessionDescription);
                console.log('Sent answer.');
            }
        });

        this.on('icecandidate', async (candidate) => {
            if (this.peerConnection) {
                const iceCanditate = new WebRTC.RTCIceCandidate(candidate);
                this.peerConnection.addIceCandidate(iceCanditate);
            }
        });
        this.once('icecandidate', () => {
            console.log('Got ICE candidate(s).');
        });
    }

    async connect() {
        this.state = 'connecting';
        this.randid = randomToken();

        const startResponse = await this.axios.post('/start', new url.URLSearchParams({}), {
            params: {
                caps: 'recaptcha2,t',
                firstevents: '1',
                spid: '',
                randid: this.randid,
                topics: JSON.stringify(this.topics),
                lang: 'en',
                ...this.video
                    ? { webrtc: '1', camera: CAMERA }
                    : { rcs: '1' }, // ???
                group: '',
            },
        });

        this.state = 'connected';

        this.clientID = startResponse.data.clientID;
        this.handleEvents(startResponse.data.events);
    }

    handleEvents(events = []) {
        for (const [eventName, ...eventValues] of events) {
            // console.log('Event:', eventName);
            this.emit(eventName, eventValues);
        }
    }

    async getEvents() {
        const eventsResponse = await this.axios.post('/events', new url.URLSearchParams({
            id: this.clientID,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
        });

        if (eventsResponse.data) {
            this.handleEvents(eventsResponse.data);
        }

        await this.getEvents();
    }

    async typing() {
        await this.axios.post('/typing', new url.URLSearchParams({
            id: this.clientID,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
        });
    }

    async send(message) {
        await this.axios.post('/send', new url.URLSearchParams({
            id: this.clientID,
            msg: message,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
        });
    }

    async rtcPeerConnection(desc) {
        try {
            await this.axios.post('/rtcpeerdescription', new url.URLSearchParams({
                id: this.clientID,
                desc,
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
            });
        } catch(err) {
            console.error(err);
        }
    }

    async iceCandidate(candidate) {
        await this.axios.post('/icecandidate', new url.URLSearchParams({
            id: this.clientID,
            candidate,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
        });
    }

    async upload() {
        const uploadResponse = await this.axios.post('/upload', new url.URLSearchParams({
            camera: CAMERA,
            num_frames: 4,
            frame_delay: 300,
            randid: this.randid
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
        });


    }

    async disconnect() {
        this.state = 'disconnecting';

        await this.axios.post('/disconnect', new url.URLSearchParams({
            id: this.clientID,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
        });
        
        this.state = 'disconnected';
    }

    async initPeerConnection() {
        console.log('Initializing peer connection...');
        this.peerConnection = new WebRTC.RTCPeerConnection({
            iceServers: [{
                urls: STUN_SERVERS,
            }],
        }, {
            optional: [{
                DtlsSrtpKeyAgreement: true,
            }],
        });

        this.peerConnection.addEventListener('connectionstatechange', async (event) => {
            console.log('Peer connection status:', pc.connectionState);
        });
        this.peerConnection.addEventListener('icecandidate', async (event) => {
            // Wait for RTCPeerConnection to generate an ice candidate.
            if (event.candidate) {
                console.log('Generated icecandidate. Sending...');
                await this.iceCandidate(JSON.stringify(event.candidate));
                console.log('Sent icecandidate.');
            }
        });

        // ---------

        console.log('Loading image...');
        const gnomeImg = new Canvas.Image();
        gnomeImg.dataMode = Canvas.Image.MODE_IMAGE; // Only image data tracked
        gnomeImg.src = await fs.readFile(path.resolve('./medias/gnome.png'));

        const WIDTH = 640;
        const HEIGHT = 480;
        const canvas = Canvas.createCanvas(WIDTH, HEIGHT);
        const context = canvas.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, WIDTH, HEIGHT);
        context.drawImage(gnomeImg, 0, 0, gnomeImg.width, gnomeImg.height);
        const rgbaFrame = context.getImageData(0, 0, WIDTH, HEIGHT);
        const i420Frame = {
            width: WIDTH,
            height: HEIGHT,
            data: new Uint8ClampedArray(1.5 * WIDTH * HEIGHT)
        };
        WebRTC.nonstandard.rgbaToI420(rgbaFrame, i420Frame);

        const source = new WebRTC.nonstandard.RTCVideoSource();
        const track = source.createTrack();
        const transceiver = this.peerConnection.addTransceiver(track);
        // const sink = new WebRTC.nonstandard.RTCVideoSink(transceiver.sender.track);
        source.onFrame(i420Frame);

        // ---------

        console.log('Creating offer...');
        const sessionDescription = await this.peerConnection.createOffer({
            mandatory: {
                OfferToReceiveAudio: false, // TODO: true
                OfferToReceiveVideo: true,
            },
        });
        
        if (!sessionDescription) {
            console.error('Failed to generate an ICE offer. Disconnecting...');
            await this.disconnect();
            return;
        }

        console.log('Generated signalling offer.');

        await this.peerConnection.setLocalDescription(sessionDescription);
        await this.rtcPeerConnection(JSON.stringify(sessionDescription));

        console.log('Sent offer.');
    }
}

export default Connection;
