const state = {
  mode: 'split',
  opacity: 48,
  split: 50,
  comparison: 50,
  cameraStream: null,
  historicSrc: '',
  historicName: 'Historic Collingham reference',
  activePhotoId: null,
  activePhotoSource: 'bundled',
  capturedSrc: '',
  target: {
    heading: null,
    tilt: null,
    latitude: null,
    longitude: null
  },
  orientation: {
    heading: null,
    tilt: null
  },
  position: null
};

const samplePhotoSrc = './assets/demo-historic-collingham-reference.png';
const cameraFeed = document.getElementById('cameraFeed');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const historicOverlay = document.getElementById('historicOverlay');
const referencePreview = document.getElementById('referencePreview');
const alignmentScore = document.getElementById('alignmentScore');
const alignmentInstruction = document.getElementById('alignmentInstruction');
const gpsSignal = document.getElementById('gpsSignal');
const compassSignal = document.getElementById('compassSignal');
const tiltSignal = document.getElementById('tiltSignal');
const hudScore = document.getElementById('hudScore');
const hudHint = document.getElementById('hudHint');
const viewpointLabel = document.getElementById('viewpointLabel');
const resultPanel = document.getElementById('resultPanel');
const beforeImage = document.getElementById('beforeImage');
const afterImage = document.getElementById('afterImage');
const comparisonBefore = document.getElementById('comparisonBefore');
const comparisonRange = document.getElementById('comparisonRange');
const cameraStage = document.getElementById('cameraStage');

const historicFile = document.getElementById('historicFile');
const opacityInput = document.getElementById('opacity');
const splitInput = document.getElementById('split');
const openHistory = document.getElementById('openHistory');
const loadSample = document.getElementById('loadSample');
const saveViewpoint = document.getElementById('saveViewpoint');
const cameraButton = document.getElementById('cameraButton');
const captureButton = document.getElementById('captureButton');
const downloadComparison = document.getElementById('downloadComparison');
const photoDeckList = document.getElementById('photoDeck');
const photoDeckCount = document.getElementById('photoDeckCount');
const modeButtons = [...document.querySelectorAll('.mode')];
const navButtons = [...document.querySelectorAll('.nav-pill')];
const comparisonSlider = document.getElementById('comparisonSlider');

const photoDeck = [];
const bundledDeckItem = {
  id: 'bundled-reference',
  name: 'Historic Collingham reference',
  source: 'bundled',
  src: samplePhotoSrc
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderReferencePreview = (item) => {
  if (!item) {
    referencePreview.innerHTML = '<span>No photo loaded yet</span>';
    return;
  }

  const sourceLabel = item.source === 'gallery'
    ? 'From your Collingham photo folder'
    : item.source === 'upload'
      ? 'Uploaded on this device'
      : 'Built-in sample';
  referencePreview.innerHTML = `
    <img src="${item.src}" alt="${escapeHtml(item.name)}" />
    <div class="reference-meta">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(sourceLabel)}</span>
    </div>
  `;
};

const renderPhotoDeck = () => {
  photoDeckCount.textContent = `${photoDeck.length} loaded`;
  photoDeckList.innerHTML = '';
  photoDeck.forEach((item) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'photo-card';
    card.classList.toggle('is-active', state.activePhotoId === item.id);
    card.innerHTML = `
      <img src="${item.src}" alt="${escapeHtml(item.name)}" />
      <div>
        <span class="chip">${escapeHtml(item.source)}</span>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.source === 'gallery'
          ? 'Tap to use this historic frame.'
          : item.source === 'upload'
            ? 'Added from your device.'
            : 'Starter sample frame.'}</span>
      </div>
    `;
    card.addEventListener('click', () => selectPhoto(item.id));
    photoDeckList.appendChild(card);
  });
};

const setHistoricImage = (src, name = 'Historic Collingham reference', source = 'bundled', id = null) => {
  state.historicSrc = src;
  state.historicName = name;
  state.activePhotoSource = source;
  state.activePhotoId = id;
  historicOverlay.src = src;
  historicOverlay.alt = name;
  beforeImage.src = src;
  renderReferencePreview({ src, name, source });
  viewpointLabel.textContent = name;
  updateAlignment();
};

const setDemoFrame = () => {
  if (photoDeck.length > 0) {
    selectPhoto(photoDeck[0].id);
    return;
  }
  setHistoricImage(samplePhotoSrc, 'Historic Collingham reference', 'bundled', bundledDeckItem.id);
};

const selectPhoto = (id) => {
  const item = photoDeck.find((entry) => entry.id === id);
  if (!item) return;
  setHistoricImage(item.src, item.name, item.source, item.id);
  renderPhotoDeck();
};

const seedPhotoDeck = async () => {
  let remoteItems = [];
  try {
    const response = await fetch('./api/gallery');
    if (response.ok) {
      const data = await response.json();
      remoteItems = Array.isArray(data.items) ? data.items : [];
    }
  } catch (error) {
    console.warn('Gallery API unavailable, using bundled sample only.', error);
  }

  photoDeck.length = 0;
  photoDeck.push(
    bundledDeckItem,
    ...remoteItems.filter((item) => item && item.src && item.id && item.id !== bundledDeckItem.id)
  );
  renderPhotoDeck();
  if (photoDeck.length > 0) {
    selectPhoto(photoDeck[0].id);
  }
};

const addUploadedPhotos = (files) => {
  [...files].forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const uniqueId = `upload:${file.name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const item = {
        id: uniqueId,
        name: file.name.replace(/\.[^.]+$/, ''),
        source: 'upload',
        src: reader.result
      };
      photoDeck.unshift(item);
      renderPhotoDeck();
      selectPhoto(item.id);
    };
    reader.readAsDataURL(file);
  });
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const haversine = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const angleDistance = (a, b) => {
  if (a === null || b === null) return null;
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
};

const scoreAlignment = () => {
  const headingDiff = angleDistance(state.target.heading, state.orientation.heading);
  const tiltDiff = state.target.tilt !== null && state.orientation.tilt !== null
    ? Math.abs(state.target.tilt - state.orientation.tilt)
    : null;
  const locationDiff = state.target.latitude !== null && state.position
    ? haversine({ latitude: state.target.latitude, longitude: state.target.longitude }, state.position)
    : null;

  const headingScore = headingDiff === null ? 74 : clamp(100 - headingDiff * 3, 0, 100);
  const tiltScore = tiltDiff === null ? 78 : clamp(100 - tiltDiff * 7, 0, 100);
  const locationScore = locationDiff === null ? 82 : clamp(100 - locationDiff * 5, 0, 100);
  return {
    score: Math.round((headingScore * 0.4) + (tiltScore * 0.35) + (locationScore * 0.25)),
    headingDiff,
    tiltDiff,
    locationDiff
  };
};

const instructionFromScore = ({ score, headingDiff, tiltDiff, locationDiff }) => {
  if (locationDiff !== null && locationDiff > 4) {
    return `Move about ${Math.round(locationDiff)} m toward the saved spot.`;
  }
  if (headingDiff !== null && headingDiff > 5) {
    return `Turn ${((state.target.heading - state.orientation.heading + 360) % 360) < 180 ? 'right' : 'left'} about ${Math.round(headingDiff)}°.`;
  }
  if (tiltDiff !== null && tiltDiff > 2) {
    return `${state.orientation.tilt < state.target.tilt ? 'Tilt up' : 'Tilt down'} ${Math.round(tiltDiff)}°.`;
  }
  if (score >= 88) {
    return 'View matched. Hold steady and take the shot.';
  }
  return 'Move slowly and keep the roofline centered.';
};

const updateAlignment = () => {
  const { score, headingDiff, tiltDiff, locationDiff } = scoreAlignment();
  alignmentScore.textContent = `${score}%`;
  hudScore.textContent = `${score}% matched`;
  const signalText = score >= 88 ? 'Matched' : score >= 68 ? 'Close' : 'Searching';
  hudScore.classList.toggle('matched', score >= 88);
  alignmentScore.classList.toggle('matched', score >= 88);

  alignmentInstruction.textContent = instructionFromScore({ score, headingDiff, tiltDiff, locationDiff });
  hudHint.textContent = alignmentInstruction.textContent;

  gpsSignal.textContent = state.position ? `${Math.round(locationDiff || 0)} m` : 'Waiting';
  compassSignal.textContent = state.orientation.heading === null ? 'Waiting' : `${Math.round(state.orientation.heading)}°`;
  tiltSignal.textContent = state.orientation.tilt === null ? 'Waiting' : `${Math.round(state.orientation.tilt)}°`;
  modeButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.mode === state.mode));
  cameraStage.classList.toggle('ghost-mode', state.mode === 'ghost');
  cameraStage.classList.toggle('split-mode', state.mode === 'split');
  historicOverlay.style.opacity = String(state.mode === 'ghost' ? state.opacity / 100 : 1);
  historicOverlay.style.clipPath = state.mode === 'split'
    ? `inset(0 ${100 - state.split}% 0 0)`
    : 'none';
  splitHandle.style.left = `${state.split}%`;
  comparisonBefore.style.width = `${state.comparison}%`;
  if (state.mode === 'split') {
    splitHandle.style.display = 'block';
  } else {
    splitHandle.style.display = 'none';
  }
  comparisonRange.value = String(state.comparison);
  comparisonSlider.style.left = `${state.comparison}%`;
  cameraPlaceholder.hidden = Boolean(cameraFeed.srcObject);
  resultPanel.hidden = !state.capturedSrc;
  if (state.capturedSrc) {
    afterImage.src = state.capturedSrc;
  }
  referencePreview.dataset.signal = signalText;
};

const stopCamera = () => {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
  }
  cameraFeed.srcObject = null;
  cameraPlaceholder.hidden = false;
};

const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    state.cameraStream = stream;
    cameraFeed.srcObject = stream;
    await cameraFeed.play();
    cameraPlaceholder.hidden = true;
  } catch (error) {
    console.warn('Camera unavailable, staying in demo mode.', error);
    cameraPlaceholder.hidden = false;
  }
  updateAlignment();
};

const saveViewpointHandler = () => {
  state.target = {
    heading: state.orientation.heading,
    tilt: state.orientation.tilt,
    latitude: state.position?.latitude ?? null,
    longitude: state.position?.longitude ?? null
  };
  updateAlignment();
  alignmentInstruction.textContent = 'Saved this spot. Come back here and line up the same view.';
};

const captureStill = async () => {
  const video = cameraFeed;
  const width = video.videoWidth || 1600;
  const height = video.videoHeight || 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (video.srcObject && video.videoWidth) {
    ctx.drawImage(video, 0, 0, width, height);
  } else {
    const img = new Image();
    img.src = state.historicSrc || samplePhotoSrc;
    await img.decode();
    ctx.drawImage(img, 0, 0, width, height);
  }
  state.capturedSrc = canvas.toDataURL('image/jpeg', 0.92);
  afterImage.src = state.capturedSrc;
  resultPanel.hidden = false;
};

const downloadBeforeAfter = () => {
  if (!state.capturedSrc || !state.historicSrc) return;
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const drawCover = async (src, x, w) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.max(w / img.width, canvas.height / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + ((w - dw) / 2), (canvas.height - dh) / 2, dw, dh);
  };
  Promise.all([drawCover(state.historicSrc, 0, 800), drawCover(state.capturedSrc, 800, 800)]).then(() => {
    ctx.fillStyle = 'rgba(18, 63, 60, 0.9)';
    ctx.fillRect(0, 826, 1600, 74);
    ctx.fillStyle = '#fffef4';
    ctx.font = '700 30px Arial, sans-serif';
    ctx.fillText('THEN', 36, 874);
    ctx.fillText('NOW', 836, 874);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.download = 'photo-overlay-then-now.jpg';
    a.click();
  });
};

const splitHandle = document.getElementById('splitHandle');

historicFile.addEventListener('change', (event) => {
  const files = [...(event.target.files || [])];
  if (!files.length) return;
  addUploadedPhotos(files);
  event.target.value = '';
});

opacityInput.addEventListener('input', (event) => {
  state.opacity = Number(event.target.value);
  updateAlignment();
});

splitInput.addEventListener('input', (event) => {
  state.split = Number(event.target.value);
  updateAlignment();
});

comparisonRange.addEventListener('input', (event) => {
  state.comparison = Number(event.target.value);
  updateAlignment();
});

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    updateAlignment();
  });
});

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    navButtons.forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
  });
});

openHistory.addEventListener('click', () => {
  document.querySelector('.workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

loadSample.addEventListener('click', () => {
  setDemoFrame();
});

saveViewpoint.addEventListener('click', saveViewpointHandler);
cameraButton.addEventListener('click', () => {
  if (state.cameraStream) {
    stopCamera();
  } else {
    void startCamera();
  }
});
captureButton.addEventListener('click', () => void captureStill());
downloadComparison.addEventListener('click', downloadBeforeAfter);

window.addEventListener('deviceorientation', (event) => {
  const heading = typeof event.webkitCompassHeading === 'number'
    ? event.webkitCompassHeading
    : typeof event.alpha === 'number'
      ? (360 - event.alpha) % 360
      : null;
  state.orientation.heading = heading;
  state.orientation.tilt = typeof event.beta === 'number' ? event.beta : null;
  updateAlignment();
}, true);

if (navigator.geolocation) {
  navigator.geolocation.watchPosition((position) => {
    state.position = position.coords;
    updateAlignment();
  }, () => {
    gpsSignal.textContent = 'Unavailable';
  }, { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 });
}

if (window.location.search.includes('time_lens=1')) {
  document.querySelector('.workspace').scrollIntoView();
}

void seedPhotoDeck();
updateAlignment();
void startCamera();
