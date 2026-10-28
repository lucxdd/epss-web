'use strict';
const media = window.EPSS_MEDIA;
const realGroup = document.querySelector('[data-video-group="real"]');
const simulationGroup = document.querySelector('[data-video-group="simulation"]');
const capitalize = s => s[0].toUpperCase() + s.slice(1);

function makeVideo(source, label, group) {
  const video = document.createElement('video');
  video.controls = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = source.poster;
  video.src = source.src;
  video.setAttribute('aria-label', label);
  video.playbackRate = Number(group.querySelector('[data-speed]').value);
  video.addEventListener('error', () => {
    group.querySelector('.media-status').textContent = 'A video could not be loaded. Please reload the page or check the video file.';
  });
  return video;
}
function stopGroup(group) {
  group.dataset.generation = String(Number(group.dataset.generation || 0) + 1);
  group.querySelectorAll('video').forEach(v => v.pause());
}
function renderReal(color = 'blue') {
  stopGroup(realGroup);
  const grid = document.querySelector('#real-videos');
  grid.querySelectorAll('video').forEach(video => {
    video.removeAttribute('src');video.load();
  });
  grid.replaceChildren();
  document.querySelectorAll('[data-real-color]').forEach(button => {
    const selected = button.dataset.realColor === color;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  grid.setAttribute('aria-labelledby', `real-tab-${color}`);
  media.real[color].forEach((source, index) => {
    const card = document.createElement('article');
    card.className = 'video-card';
    card.innerHTML = `<div class="card-top"><h3>${capitalize(color)} cup</h3><span class="index">${String(index + 1).padStart(2, '0')} / 05</span></div>`;
    card.append(makeVideo(source, `${capitalize(color)} cup, trial ${index + 1}: unguided prediction, EPSS prediction, and guided execution`, realGroup));
    grid.append(card);
  });
  realGroup.querySelector('.media-status').textContent='';
}
function renderTask(task) {
  stopGroup(simulationGroup);
  const grid = document.querySelector('#simulation-videos');
  grid.replaceChildren();
  document.querySelector('#task-title').textContent = task.label;
  document.querySelector('#task-description').textContent = task.description;
  const target = document.querySelector('#task-target');
  target.hidden = !task.target;
  target.textContent = task.target ? `Target: ${task.target}` : '';
  document.querySelectorAll('[data-task]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.task === task.id)));
  media.methods.forEach((method, index) => {
    const card = document.createElement('article');
    card.className = `video-card ${method.id === 'epss' ? 'ours' : ''}`;
    card.innerHTML = `<div class="card-top"><h3>${method.label}</h3><span class="index">0${index + 1}</span></div>`;
    card.append(makeVideo(task.videos[method.id], `${task.label}: ${method.label}`, simulationGroup));
    grid.append(card);
  });
  simulationGroup.querySelector('.media-status').textContent = '';
}
function ready(video) {
  if (video.readyState >= 3) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('timeout')), 20000);
    const done = () => finish();
    const fail = () => finish(new Error('load'));
    function finish(error) {
      clearTimeout(timer);video.removeEventListener('canplay', done);video.removeEventListener('error', fail);
      error ? reject(error) : resolve();
    }
    video.addEventListener('canplay', done, {once:true});
    video.addEventListener('error', fail, {once:true});
    video.preload = 'auto';video.load();
  });
}
async function playGroup(group, restart) {
  stopGroup(group);
  const generation = group.dataset.generation;
  const videos = [...group.querySelectorAll('video')];
  const status = group.querySelector('.media-status');status.textContent = 'Loading videos…';
  try {
    await Promise.all(videos.map(ready));
    if (group.dataset.generation !== generation) return;
    if (restart) videos.forEach(v => { v.currentTime = 0; });
    else videos.filter(v => v.ended).forEach(v => { v.currentTime = 0; });
    const attempts = await Promise.allSettled(videos.map(v => v.play()));
    if (group.dataset.generation !== generation) return;
    status.textContent = attempts.some(r => r.status === 'rejected') ? 'Use the play button on each video if your browser blocks group playback.' : '';
  } catch {
    if (group.dataset.generation === generation) status.textContent = 'Some videos could not be loaded. Try again or use the individual video controls.';
  }
}
if (media) {
  const picker = document.querySelector('.task-picker');
  media.tasks.forEach(task => {
    const button = document.createElement('button');button.type='button';button.textContent=task.label;button.dataset.task=task.id;
    button.setAttribute('aria-controls', 'simulation-videos');button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => renderTask(task));picker.append(button);
  });
  const colorTabs = [...document.querySelectorAll('[data-real-color]')];
  colorTabs.forEach((button, index) => {
    button.addEventListener('click', () => renderReal(button.dataset.realColor));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % colorTabs.length;
      if (event.key === 'ArrowLeft') next = (index + colorTabs.length - 1) % colorTabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = colorTabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();colorTabs[next].focus();colorTabs[next].click();
    });
  });
  renderReal();renderTask(media.tasks[0]);
  document.querySelectorAll('[data-video-group]').forEach(group => {
    group.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.action === 'pause') {stopGroup(group);group.querySelector('.media-status').textContent='';}
      else playGroup(group, button.dataset.action === 'restart');
    }));
    group.querySelector('[data-speed]').addEventListener('change', event => {
      group.querySelectorAll('video').forEach(video => {video.playbackRate=Number(event.target.value);});
    });
  });
} else {
  document.querySelectorAll('.media-status').forEach(status => {status.textContent='Video data is unavailable. Please reload the page.';});
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) document.querySelectorAll('[data-video-group]').forEach(stopGroup);
});
