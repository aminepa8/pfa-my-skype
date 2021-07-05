'use strict';

//Loading dependencies & initializing express
var os = require('os');
var https = require('https');
var fs = require('fs');
var express = require('express');
var app = express();
var https = require('https');
//For signalling in WebRTC
var socketIO = require('socket.io');
var bodyParser = require('body-parser'); 
//Rooms Array
let rooms = {}
//self signed ssl
var options = {
    key: fs.readFileSync('certificates/key.pem', 'utf8'),
    cert: fs.readFileSync('certificates/cert.pem', 'utf8'),
    requestCert: false,
    rejectUnauthorized: false
};

app.use(express.static('public'))
app.use(bodyParser.json())
app.get("/", function(req, res){
	res.render("index.ejs");
});

function CheckRoomPass (username, room, password) {
	if (!rooms[room] || (rooms[room] && !rooms[room].password)) {
		if (!rooms[room]) {
			rooms[room] = {};
		}
		rooms[room].password = password;
		//rooms[room][socketId] = username;
		//rooms[socketId] = room;
		return true;
	} else {
		if (rooms[room].password == password) {
			//rooms[socketId] = room;
			//rooms[room][socketId] = username;
			//socket.join(room);
			return true;
		} else {
			return false;
		}
	}
}
//Test NewChat style
app.post("/chat", function(req, res){
	
	if(CheckRoomPass(req.body.username, req.body.roomName, req.body.password)) {
		console.log('Client said: ', req.body.roomName);
		console.log('Client said: ', req.body.username);
		console.log('Client said: ', req.body.password);
		res.send({status:true, data:{roomName:req.body.roomName, username:req.body.username, password:req.body.password}})

	} else {
		res.send({status:false})
	}
	//res.render("chatNew.ejs"),{roomName: req.params.roomName, username: req.params.username};
});
app.get("/chat", function(req, res){
	res.render("chatNew.ejs");
});



var server = https.createServer(options,app);

server.listen(process.env.PORT || 8000);

var io = socketIO(server);

io.sockets.on('connection', function(socket) {

	// Convenience function to log server messages on the client.
	// Arguments is an array like object which contains all the arguments of log(). 
	// To push all the arguments of log() in array, we have to use apply().
	function log() {
	  var array = ['Message from server:'];
	  array.push.apply(array, arguments);
	  socket.emit('log', array);
	}
  
    
    //Defining Socket Connections
    socket.on('message', function(message, room) {
	  log('Client said: ', message);
	  // for a real app, would be room-only (not broadcast)
	  socket.in(room).emit('message', message, room);
	});
  //PublicKey Order to exchange Step3
	 socket.on('exchangePubKeys', ({ PublicKey, room }) =>{
		
		socket.in(room).emit('ExchangePublicKeyNow', {PublicKey:PublicKey, room :room});
		
	  });

	socket.on('create or join', function(room) {
	  log('Received request to create or join room ' + room);
  
	  var clientsInRoom = io.sockets.adapter.rooms[room];
	  var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
	  log('Room ' + room + ' now has ' + numClients + ' client(s)');
  
	  if (numClients === 0) {
		socket.join(room);
		log('Client ID ' + socket.id + ' created room ' + room);
		socket.emit('created', room, socket.id);
  
	  } else if (numClients === 1) {
		log('Client ID ' + socket.id + ' joined room ' + room);
		io.sockets.in(room).emit('join', room);
		socket.join(room);
		socket.emit('joined', room, socket.id);
		//Exchange Key signal step1
		socket.emit('StartPublicKeysExchange',room);
		io.sockets.in(room).emit('ready');
	  } else { // max two clients
		socket.emit('full', room);
	  }
	});
  
	socket.on('ipaddr', function() {
	  var ifaces = os.networkInterfaces();
	  for (var dev in ifaces) {
		ifaces[dev].forEach(function(details) {
		  if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
			socket.emit('ipaddr', details.address);
		  }
		});
	  }
	});
  
	socket.on('bye', function(){
	  console.log('received bye');
	});
	

	//Chat 
	socket.on('messageChat', ({roomname,username,message}) => {
		io.to(roomname).emit('createMessage', {message:message,username:username})
	})
  });

  