const startButton = document.getElementById("startButton");
const callButton = document.getElementById("callButton");
const hangupButton = document.getElementById("hangupButton");
const stopButton = document.getElementById("stopButton");
const muteButton = document.getElementById("muteButton");
const localHangupButton = document.getElementById("localHangupButton");
const remoteHangupButton = document.getElementById("remoteHangupButton");
const stopSendingButton = document.getElementById("stopSendingButton");
const stopTrans1Button = document.getElementById("stopTrans1Button");
const stopTrans2Button = document.getElementById("stopTrans2Button");

callButton.disabled = true;
hangupButton.disabled = true;
stopButton.disabled = true;
muteButton.disabled = true;
localHangupButton.disabled = true;
remoteHangupButton.disabled = true;
stopSendingButton.disabled = true;
stopTrans1Button.disabled = true;
stopTrans2Button.disabled = true;

startButton.addEventListener("click", start);
callButton.addEventListener("click", call);
hangupButton.addEventListener("click", hangup);
stopButton.addEventListener("click", stop);
muteButton.addEventListener("click", toggleMute());
localHangupButton.addEventListener("click", localHangup);
remoteHangupButton.addEventListener("click", remoteHangup);
stopSendingButton.addEventListener("click", stopSending);
stopTrans1Button.addEventListener("click", stopTrans1);
stopTrans2Button.addEventListener("click", stopTrans2);

let startTime;
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

localVideo.addEventListener("loadedmetadata", function () {
  console.log(
    `Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
  );
});

remoteVideo.addEventListener("loadedmetadata", function () {
  console.log(
    `Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
  );
});

remoteVideo.addEventListener("resize", () => {
  console.log(
    `Remote video size changed to ${remoteVideo.videoWidth}x${
      remoteVideo.videoHeight
    } - Time since pageload ${performance.now().toFixed(0)}ms`
  );
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    console.log("Setup time: " + elapsedTime.toFixed(3) + "ms");
    startTime = null;
  }
});

let localStream;
let localSender;
let localAudioTrack;
let pc1;
let pc2;
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 0
};

const pc = {
  pc1: pc1,
  pc2: pc2
};

function getName(pc) {
  return pc === pc1 ? "pc1" : "pc2";
}

function getOtherPc(pc) {
  return pc === pc1 ? pc2 : pc1;
}

async function start() {
  console.log("Requesting local stream");
  startButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });
    console.log("Received local stream");
    localVideo.srcObject = stream;
    localStream = stream;
    localAudioTrack = localStream.getAudioTracks()[0];
    callButton.disabled = false;
    stopButton.disabled = false;
    muteButton.disabled = false;
  } catch (e) {
    alert(`getUserMedia() error: ${e.name}`);
  }
}

async function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  localHangupButton.disabled = false;
  remoteHangupButton.disabled = false;
  stopSendingButton.disabled = false;
  stopTrans1Button.disabled = false;
  stopTrans2Button.disabled = false;
  console.log("Starting call");
  startTime = window.performance.now();
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
  }
  const configuration = {};
  console.log("RTCPeerConnection configuration:", configuration);
  pc1 = new RTCPeerConnection(configuration);
  console.log("Created local peer connection object pc1");
  pc1.addEventListener("icecandidate", (e) => onIceCandidate(pc1, e));
  pc2 = new RTCPeerConnection(configuration);
  pc["pc1"] = pc1;
  pc["pc2"] = pc2;
  console.log("Created remote peer connection object pc2");
  pc2.addEventListener("icecandidate", (e) => onIceCandidate(pc2, e));
  pc1.addEventListener("iceconnectionstatechange", (e) =>
    onIceStateChange(pc1, e)
  );
  pc2.addEventListener("iceconnectionstatechange", (e) =>
    onIceStateChange(pc2, e)
  );
  pc2.addEventListener("track", gotRemoteStream);
  pc1.addEventListener("negotiationneeded", () => {
    //negotiate();
  });
  localStream.getTracks().forEach((track) => {
    localSender = pc1.addTrack(track, localStream);
    let id = "pc1";
    track.addEventListener("ended", (event) => {
      logEvent.call(this, id, "track ended", event);
    });
    track.addEventListener("mute", (event) => {
      logEvent.call(this, id, "track mute", event);
    });
    track.addEventListener("unmute", (event) => {
      logEvent.call(this, id, "track unmute", event);
    });
  });
  console.log("Added local stream to pc1");

  addEventListeners(pc1, "pc1");
  addEventListeners(pc2, "pc2");
  await negotiate();
}

async function negotiate() {
  try {
    console.log("pc1 createOffer start");
    const offer = await pc1.createOffer(offerOptions);
    await onCreateOfferSuccess(offer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

async function onCreateOfferSuccess(desc) {
  console.log(`Offer from pc1\n${desc.sdp}`);
  console.log("pc1 setLocalDescription start");
  try {
    await pc1.setLocalDescription(desc);
    onSetLocalSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError();
  }

  console.log("pc2 setRemoteDescription start");
  try {
    await pc2.setRemoteDescription(desc);
    onSetRemoteSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError();
  }

  console.log("pc2 createAnswer start");
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  try {
    const answer = await pc2.createAnswer();
    await onCreateAnswerSuccess(answer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

function onSetLocalSuccess(pc) {
  console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
  console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
}

function gotRemoteStream(e) {
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log("pc2 received remote stream");
  }
}

async function onCreateAnswerSuccess(desc) {
  console.log(`Answer from pc2:\n${desc.sdp}`);
  console.log("pc2 setLocalDescription start");
  try {
    await pc2.setLocalDescription(desc);
    onSetLocalSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
  console.log("pc1 setRemoteDescription start");
  try {
    await pc1.setRemoteDescription(desc);
    onSetRemoteSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
}

async function onIceCandidate(pc, event) {
  try {
    await getOtherPc(pc).addIceCandidate(event.candidate);
    onAddIceCandidateSuccess(pc);
  } catch (e) {
    onAddIceCandidateError(pc, e);
  }
  console.log(
    `${getName(pc)} ICE candidate:\n${
      event.candidate ? event.candidate.candidate : "(null)"
    }`
  );
}

function onAddIceCandidateSuccess(pc) {
  console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
  console.log(
    `${getName(pc)} failed to add ICE Candidate: ${error.toString()}`
  );
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
    console.log("ICE state change event: ", event);
  }
}

function toggleMute() {
  let enabled = true;
  return () => {
    if (enabled) {
      disableTrack();
    } else {
      enableTrack();
    }
    enabled = !enabled;
  };
}

function enableTrack() {
  muteButton.textContent = "Mute";
  localAudioTrack.enabled = true;
}

function disableTrack() {
  muteButton.textContent = "Unmute";
  localAudioTrack.enabled = false;
}

function stop() {
  localAudioTrack.stop();
  stopButton.disabled = true;
  startButton.disabled = false;
}

function localHangup() {
  pc1.close();
  pc1 = null;
  localVideo.srcObject = null;
  localHangupButton.disabled = true;
}

function remoteHangup() {
  pc2.close();
  pc2 = null;
  remoteVideo.srcObject = null;
  remoteHangupButton.disabled = true;
}

function stopSending() {
  pc1.removeTrack(localSender);
  stopSendingButton.disabled = true;
}

function stopTrans1() {
  pc1.getTransceivers()[0].stop();
  stopTrans1Button.disabled = false;
}

function stopTrans2() {
  pc2.getTransceivers()[0].stop();
  stopTrans2Button.disabled = false;
}

function hangup() {
  console.log("Ending call");
  pc1 && pc1.close();
  pc2 && pc2.close();
  pc1 = null;
  pc2 = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
}

function logEvent(id, eventName, event) {
  let eventState = "";

  if (eventName === "connectionstatechange") {
    eventState = pc[id].connectionState;
  } else if (eventName === "iceconnectionstatechange") {
    eventState = pc[id].iceConnectionState;
  } else if (eventName === "icegatheringstatechange") {
    eventState = pc[id].iceGatheringState;
  } else if (eventName === "signalingstatechange") {
    eventState = pc[id].signalingState;
  }
  console.log(`[${id}]`, eventName, event, eventState);
  document
    .getElementById(`${id}-info`)
    .append(`${eventName}: ${eventState}`, document.createElement("li"));
}
function addEventListeners(pc, id) {
  console.log("Adding eventListeners", id);
  pc.addEventListener("connectionstatechange", (event) =>
    logEvent.call(this, id, "connectionstatechange", event)
  );
  pc.addEventListener("icecandidate", (event) =>
    logEvent.call(this, id, "icecandidate", event)
  );
  pc.addEventListener("icecandidateerror", (event) =>
    logEvent.call(this, id, "icecandidateerror", event)
  );
  pc.addEventListener("iceconnectionstatechange", (event) =>
    logEvent.call(this, id, "iceconnectionstatechange", event)
  );
  pc.addEventListener("icegatheringstatechange", (event) =>
    logEvent.call(this, id, "icegatheringstatechange", event)
  );
  pc.addEventListener("negotiationneeded", (event) =>
    logEvent.call(this, id, "negotiationneeded", event)
  );
  pc.addEventListener("signalingstatechange", (event) =>
    logEvent.call(this, id, "signalingstatechange", event)
  );
  pc.addEventListener("track", (event) => {
    logEvent.call(this, id, "track", event);
    event.track.addEventListener("ended", (event) => {
      logEvent.call(this, id, "track ended", event);
    });
    event.track.addEventListener("mute", (event) => {
      logEvent.call(this, id, "track mute", event);
    });
    event.track.addEventListener("unmute", (event) => {
      logEvent.call(this, id, "track unmute", event);
    });
  });
}
