turnConfig = {
iceServers: [
  { urls: ["stun:us-turn3.xirsys.com"] },
  {
    username:
      "cGZ6jeJ_ViYydWSbcqeQ3czSURVrkQsyftCtk6ihM9UDMMQ7Z4Pljg3AzMW0B1c4AAAAAGCO3s1tb3VsYXk0Mjc=",
    credential: "5bbb7278-ab6a-11eb-a754-0242ac140004",
    urls: [
      "turn:us-turn3.xirsys.com:80?transport=udp",
      "turn:us-turn3.xirsys.com:3478?transport=udp",
      "turn:us-turn3.xirsys.com:80?transport=tcp",
      "turn:us-turn3.xirsys.com:3478?transport=tcp",
      "turns:us-turn3.xirsys.com:443?transport=tcp",
      "turns:us-turn3.xirsys.com:5349?transport=tcp",
    ],
  },
]
}