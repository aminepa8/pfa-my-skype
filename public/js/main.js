'use strict';

//Defining some global utility variables
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

//Initialize turn/stun server here
var pcConfig = null;//turnConfig;

var localStreamConstraints = {
    audio: true,
    video: true
  };


//Not prompting for room name
//var room = 'foo';

// Prompting for room name:
var link =window.location.pathname;
var arrayParam = link.split("/");
var room = arrayParam[2]; //prompt('Enter room name:');
var username =arrayParam[3];   //prompt('Enter a username:');
$( "#chatRoomName" ).append( room);
$( "#chatusername" ).append( username);

//Initializing socket.io
var socket = io.connect();

if (room !== '') {
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
  if(pc !==null){
    pc.close();
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
let text = $('input');
    $('html').keydown(e => {
        if (e.which == 13 && text.val().length !== 0) {
            socket.emit('messageChat',{ roomname: this.room,username: this.username, message: text.val() } );
            console.log(text.val());
            text.val('')
        }
    });

    socket.on('createMessage', ({username,message}) => {
      var d = new Date();
      var hours = d.getHours();
      var minutes = d.getMinutes();
      var ChatClass = (this.username !== username) ? "chats-right" : "";
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
    })
//<li class="message"><b>user</b><br />${username} : ${message}</li>

    $( "#chatForm" ).submit(function( event ) {
      //alert( "Handler for .submit() called." );
      event.preventDefault();
    });


    