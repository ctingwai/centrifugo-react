import React, { Component } from 'react';
import './App.css';
import 'sockjs-client';
import Centrifuge from 'centrifuge';
import jsSHA from 'jssha';

const CONFIG = {
    url: 'https://centrifugo.herokuapp.com',
    user: 'whatever user id',
    secret: 'secret'
};

const styles = {
    appContainer: {
        backgroundColor: '#000',
        color: '#00ff00',
        height: '100%',
        overflowY: 'hidden',
    },
    chatWindow: {
        backgroundColor: '#111',
        height: '70vh',
        padding: 20,
        overflowY: 'scroll',
    },
    chatBubbleSystem: {
        width: '30vw',
        margin: '15px auto',
        padding: 10,
    },
    chatBubbleSelf: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: '30vw',
        margin: '15px auto',
        padding: 10,
        borderRadius: 50,
    },
    chatBubbleFriend: {
        backgroundColor: 'rgba(255,255,255,0.3)',
        width: '30vw',
        margin: '15px auto',
        padding: 10,
        borderRadius: 50,
    },
    chatReplyContainer: {
        display: 'flex',
        height: 50,
        padding: '10px',
        backgroundColor: 'black',
        position: 'absolute',
        bottom: 0,
        width: '100%',
    },
    chatReplyInput: {
        flexBasis: '80vw',
        fontSize: 24,
        fontWeight: 'bold',
    },
    chatReplyBtn: {
        flexBasis: '17vw',
    },
};

class App extends Component {
    constructor() {
        super();

        this.subscription = null;
        this.centrifuge = null;
        this.state = {
            replyMsg: '',
            messages: [],
        };
    }

    addMessage = (user, message) => {
        let newMsgState = this.state.messages.slice();
        newMsgState.push({ user, message });
        this.setState({ messages: newMsgState });
    };
    reply = () => {
        if (this.state.replyMsg === '' || !this.centrifuge.isConnected()) {
            return;
        }
        this.subscription.publish({ input: this.state.replyMsg }).then(() => {
            this.setState({ replyMsg: '' });
        });
    };
    checkKeyStroke = (e) => {
        if (e.which === 13) {
            this.reply();
        }
    };

    componentDidMount() {
        const _this = this;
        let subscribe = function() {
            _this.subscription = _this.centrifuge.subscribe('test-chat', function(message) {
                if (message.data && message.data.input) {
                    _this.addMessage(message.info.user, message.data.input);
                }
            });
            _this.subscription.on('subscribe', function() {
                _this.addMessage(null, "subscribed on channel test-chat");
            })
            _this.subscription.presence().then(function(message) {
                let newMsg = '';
                for (var key in message.data) {
                    newMsg += message.data[key].user + ', ';
                }
                newMsg = newMsg.substring(0, newMsg.length - 2);
                _this.addMessage(null, newMsg + ' is online');
            }, function(err) {});
            _this.subscription.history().then(function(message) {
                for (var key in message.data) {
                    _this.addMessage(message.data[key].info.user, message.data[key].data.input);
                }
            }, function(err) {
                console.log(err);
            });
            _this.subscription.on('join', function(message) {
                _this.addMessage(message.data.user, 'joined');
            });
            _this.subscription.on('leave', function(message) {
                _this.addMessage(message.data.user, 'user with ID ' + message.data.user + ' left');
            });
        }

        let pingInterval = null;
        // generate connection token (must be done on backend in real usage scenario)
        let timestamp = parseInt(new Date().getTime()/1000, 10).toString();
        var hmacBody = CONFIG.user + timestamp;
        var shaObj = new jsSHA("SHA-256", "TEXT");
        shaObj.setHMACKey(CONFIG.secret, "TEXT");
        shaObj.update(hmacBody);
        this.centrifuge = new Centrifuge({
            url: CONFIG.url,
            user: CONFIG.user,
            timestamp,
            token: shaObj.getHMAC("HEX"),
        });
        this.centrifuge.on('connect', function() {
            _this.addMessage(null, "connected to " + CONFIG.url);
            subscribe();
            pingInterval = setInterval(function() {
                _this.centrifuge.ping();
            }, 40000);
        });
        this.centrifuge.on('disconnect', function(){
            if (pingInterval !== null) {
                clearInterval(pingInterval);
            }
            this.addMessage('disconnected from Centrifuge');
        });
        this.centrifuge.connect();
    }

    render() {
        let _this = this;
        const messages = this.state.messages.map((msg, i) => {
            let msgStyle = styles.chatBubbleSystem;
            let theMsg = msg.message;
            if (msg.user === CONFIG.user) {
                msgStyle = styles.chatBubbleSelf;
                theMsg = 'You: ' + msg.message;
            } else if (msg.user !== null) {
                msgStyle = styles.chatBubbleFriend;
                theMsg = msg.user + ': ' + msg.message;
            }
            return (
                <div key={i} style={msgStyle}>
                    {theMsg}
                </div>
            );
        });
        return (
            <div className="App" style={styles.appContainer}>
                <div style={styles.chatWindow}>
                    {messages}
                </div>
                <div style={styles.chatReplyContainer}>
                    <input
                        type='text'
                        value={this.state.replyMsg}
                        onKeyUp={this.checkKeyStroke.bind(this)}
                        onChange={(e) => this.setState({ replyMsg: e.target.value })}
                        style={styles.chatReplyInput}
                    />
                    <input type='button' value='Reply' onClick={this.reply.bind(this)} style={styles.chatReplyBtn} />
                </div>
            </div>
        );
    }
}

export default App;
