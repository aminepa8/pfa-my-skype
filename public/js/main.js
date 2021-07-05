'use strict';
if (sessionStorage.length == 0) {
  console.log("sessionStorage.length :  " + sessionStorage.length);
  //alert("operation not allowed");
  window.location ="/";
}
console.log("sessionStorage.length :  " + sessionStorage.length);
//Defining some global utility variables
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var PublicKey;
var Privatekey;
var RemotePublicKey;

//Initialize turn/stun server here
var pcConfig = null;//turnConfig;

var localStreamConstraints = {
    audio: true,
    video: true
  };


//Generate PairKeys
function GeneratePairKeys() { 
  var keySize = 1024;
  var obj = new JSEncrypt({default_key_size: keySize});
  obj.getKey();
  sessionStorage.setItem('Publickey', obj.getPublicKey());
  sessionStorage.setItem('Privatekey', obj.getPrivateKey());
  PublicKey = obj.getPublicKey();
  console.log("My Public Key");

  console.log(PublicKey);
  //console.log(obj.getPrivateKey());

 }
 //Encrypt Func
 function Encrypt(publicKey,ClearMessage) {
    var encrypt = new JSEncrypt();
    encrypt.setPublicKey(publicKey);
    var encodedMessage = encrypt.encrypt(ClearMessage);
    return encodedMessage ;
  }
//Decrypt Func
function Decrypt(privateKey,CipherMessage) {
  var decrypt = new JSEncrypt();
  decrypt.setPrivateKey(privateKey);
  var decodedMessage = decrypt.decrypt(CipherMessage);
  return decodedMessage ;
}
// Getting data from session storage :
var data = JSON.parse(sessionStorage.getItem('user'));
var room = data.roomName;
var username = data.username; 
var password = data.password; 
console.log( "data from session storeage "+ data.roomName);
$( "#chatRoomName" ).append( room);
$( "#chatusername" ).append( username); 
$( "#roomPasswordLabel" ).append( password);
//Initializing socket.io
var socket = io.connect();

if (room !== '' & room !==null) {
  GeneratePairKeys();
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

//Defining socket connections for signalling
socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});


//Driver code
socket.on('message', function(message, room) {
    console.log('Client received message:', message,  room);
    if (message === 'got user media') {
      maybeStart();
    } else if (message.type === 'offer') {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === 'answer' && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
      handleRemoteHangup();
    }
});
  //Step 2 ExchangeKeys Process
socket.on('StartPublicKeysExchange',function(room){
  console.log("Step 2 ExchangeKeys Process :");
  console.log("Local Pub Key :");
  console.log(PublicKey);
  socket.emit('exchangePubKeys', {PublicKey:PublicKey, room:room});
  console.log("End Step2");
});
//Step 3 ExchangeKeys Process in server

//Step 4 ExchangeKeys Process finall
socket.on('ExchangePublicKeyNow',({ PublicKey, room }) =>{
  console.log("Step 4");
  console.log("Remote User PublicKey");
  RemotePublicKey= PublicKey;
  console.log(RemotePublicKey);
  //socket.emit('exchangePubKeys', this.PublicKey, room);
});

//Function to send message in a room
function sendMessage(message, room) {
  console.log('Client sending message: ', message, room);
  socket.emit('message', message, room);
}



//Displaying Local Stream and Remote Stream on webpage
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
console.log("Going to find Local media");
navigator.mediaDevices.getUserMedia(localStreamConstraints)
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});


//If found local stream
function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media', room);
  if (isInitiator) {
    maybeStart();
        //Mute and hide video after getting UserMedia
    console.log("Lool stop video");
    playStop();
    muteUnmute();
  }
}


console.log('Getting user media with constraints', localStreamConstraints);

//If initiator, create the peer connection
function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

//Sending bye if user closes the window
window.onbeforeunload = function() {
  sendMessage('bye', room);
};


//Creating peer connection
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

//Function to handle Ice candidates
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }, room);
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription, room);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}


function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  sessionStorage.clear();
  stop();
  sendMessage('bye',room);
  window.location.href ="/";
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
  $("#remoteVideo").hide();
  document.querySelector('#remoteVideo').insertAdjacentHTML('afterend', "<img class='col-md-6' src='https://m.media-amazon.com/images/I/51b4znMy09L._SS500_.jpg'>");
}

function stop() {
  isStarted = false;
  if(typeof pc !== 'undefined'){
  if(pc !==null){
    pc.close();
  }
}
  pc = null;
}

//Control
const setMuteButton = () => {
  /*
  const html = `
  <i class="fas fa-microphone"></i>
  <span>Mute</span>`
  $('.main_mute_button').html(html);
  */
  $('#audioControl').html("mic");
}

const setUnmuteButton = () => {
  /*
  const html = `
  <i class="unmute fas fa-microphone-slash"></i>
  <span>Ummte</span>`
  $('.main_mute_button').html(html);
  */
  $('#audioControl').html("mic_off");
}

const muteUnmute = () => {
  const enabled = localStream.getAudioTracks()[0].enabled;
  if(enabled){
    localStream.getAudioTracks()[0].enabled = false;
      setUnmuteButton();
  }
  else {
    setMuteButton();
      localStream.getAudioTracks()[0].enabled = true;
  }

  
}
const setPlayVideo = () => {
  /*
  const html = `
  <i class="stop fas fa-video-slash"></i>
  <span>PlayVideo</span>`
  $('.main_video_button').html(html);
  */
  $('#videoControl').html("videocam");
}

const setStopVideo = () => {
  /*
  const html = `
  <i class="fas fa-video"></i>
  <span>Stop Video</span>`
  $('.main_video_button').html(html);
  */
  $('#videoControl').html("videocam_off");
}
const playStop = () => {
  let enabled = localStream.getVideoTracks()[0].enabled;
  if(enabled){
    localStream.getVideoTracks()[0].enabled = false;
    setStopVideo();
  }
  else {
    setPlayVideo();
      
      localStream.getVideoTracks()[0].enabled = true;
  }
}


//Chat Section
const scrollToBottom = () => {
  let d = $('.slimscroll');
  d.scrollTop(d.prop("scrollHeight"));
}
var text = $('input');
const SendMsg = () => {
if( text.val().length !== 0){
  var ClearMessage=text.val();
 var EncryptedMessage = Encrypt(RemotePublicKey,ClearMessage);
  socket.emit('messageChat',{ roomname: this.room,username: this.username, message: EncryptedMessage} );
  console.log(text.val());
  text.val('')
}

}

    $('html').keydown(e => {
        if (e.which == 13 && text.val().length !== 0) {
          SendMsg();
        }
    });
    

    socket.on('createMessage', ({username,message}) => {
      var d = new Date();
      var hours = d.getHours();
      var minutes = d.getMinutes();
      var ChatClass = (this.username !== username) ? "" : "chats-right";
        $('.messages').append(`
        <div class="chats ${ChatClass}">
        <div class="chat-content">
           <div class="message-content">
           ${message}
              <div class="chat-time">
                 <div>
                    <div class="time"><i class="fas fa-clock"></i> ${hours}:${minutes}</div>
                 </div>
              </div>
           </div>
           <div class="chat-profile-name">
              <h6>${username} </h6>
           </div>
        </div>
     </div>
        `)
        scrollToBottom();
        ShakeIt();
    })
//<li class="message"><b>user</b><br />${username} : ${message}</li>

    $( "#chatForm" ).submit(function( event ) {
      //alert( "Handler for .submit() called." );
      event.preventDefault();
    });


    ///Animation chat new

  function ShakeIt(){

    $('#msg_recived').addClass('shaker'); 

    setTimeout(function(){

    $('#msg_recived').removeClass('shaker'); 
    },300);
    // eve.preventDefault();
 }

