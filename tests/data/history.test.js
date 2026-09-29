const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const historyFile = path.join(root, 'js', 'data', 'history.js');
const history = require(historyFile);
const curriculum = require(path.join(root, 'js', 'curriculum.js'));

const lessonIds = new Set(curriculum.lessons.map(lesson => lesson.id));
const personIds = new Set(history.people.map(person => person.id));
const ERA_IDS = ['ancient', 'mechanical', 'early-electronic', 'golden-age', 'modern'];
const TAGS = ['sorting', 'graphs', 'trees', 'foundations', 'hashing', 'strings', 'complexity', 'paradigms', 'hardware', 'languages'];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }

test('loads as a classic browser script and defines window.VDSA_HISTORY', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(historyFile, 'utf8'), context, { filename: historyFile });
  const api = context.window.VDSA_HISTORY;
  assert.ok(api, 'window.VDSA_HISTORY is defined');
  assert.ok(Array.isArray(api.events) && Array.isArray(api.people));
  assert.equal(api.events.length, history.events.length, 'browser and Node builds agree');
});

test('declares the agreed eras and tags', () => {
  assert.deepEqual(history.eras.map(era => era.id), ERA_IDS);
  assert.deepEqual([...history.tags].sort(), [...TAGS].sort());
});

test('has between 80 and 120 events spanning antiquity to the 2020s', () => {
  const years = history.events.map(event => event.year);
  assert.ok(history.events.length >= 80 && history.events.length <= 120, `${history.events.length} events`);
  assert.ok(Math.min(...years) <= -300, 'starts by c. 300 BCE');
  assert.ok(Math.max(...years) >= 2020, 'reaches the 2020s');
});

test('every event has a well-formed shape', () => {
  for (const event of history.events) {
    const where = `event ${event.id}`;
    assert.ok(ID_PATTERN.test(event.id), `${where}: kebab-case id`);
    assert.ok(Number.isInteger(event.year), `${where}: integer year`);
    for (const key of ['yearLabel', 'title', 'summary', 'detail']) {
      assert.ok(nonEmptyString(event[key]), `${where}: ${key} is a non-empty string`);
    }
    assert.ok(event.summary.length <= 320, `${where}: summary stays short (1–2 sentences)`);
    assert.ok(event.detail.length >= 80 && event.detail.length <= 700, `${where}: detail is 2–4 sentences`);
    assert.ok(Array.isArray(event.people), `${where}: people is an array`);
    assert.ok(Array.isArray(event.lessons) && event.lessons.length > 0, `${where}: at least one lesson`);
    assert.ok(Array.isArray(event.tags) && event.tags.length > 0, `${where}: at least one tag`);
    assert.ok(ERA_IDS.includes(event.era), `${where}: known era`);
    assert.ok(Array.isArray(event.sources) && event.sources.length > 0 && event.sources.every(nonEmptyString), `${where}: sources recorded`);
    for (const key of ['title', 'summary', 'detail']) {
      assert.ok(!/[<>"]/.test(event[key]), `${where}: ${key} is plain text without HTML or straight double quotes`);
    }
  }
});

test('event ids are unique', () => {
  const ids = history.events.map(event => event.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('events are sorted by year', () => {
  for (let i = 1; i < history.events.length; i++) {
    const before = history.events[i - 1];
    const after = history.events[i];
    assert.ok(before.year <= after.year, `${before.id} (${before.year}) comes before ${after.id} (${after.year})`);
  }
});

test('each era matches the year boundaries', () => {
  for (const event of history.events) {
    assert.equal(event.era, history.eraOf(event.year), `${event.id} in ${event.year}`);
  }
});

test('lesson ids exist in js/curriculum.js', () => {
  for (const event of history.events) {
    for (const lesson of event.lessons) assert.ok(lessonIds.has(lesson), `${event.id} points at unknown lesson ${lesson}`);
    assert.equal(new Set(event.lessons).size, event.lessons.length, `${event.id}: no repeated lessons`);
  }
});

test('every lesson has at least one history event', () => {
  for (const id of lessonIds) {
    assert.ok(history.eventsForLesson(id).length >= 1, `lesson ${id} has no history event`);
  }
});

test('tags come from the agreed list and every tag is used', () => {
  const used = new Set();
  for (const event of history.events) {
    for (const tag of event.tags) {
      assert.ok(TAGS.includes(tag), `${event.id} uses unknown tag ${tag}`);
      used.add(tag);
    }
    assert.equal(new Set(event.tags).size, event.tags.length, `${event.id}: no repeated tags`);
  }
  assert.deepEqual([...used].sort(), [...TAGS].sort());
});

test('people referenced by events exist', () => {
  for (const event of history.events) {
    for (const id of event.people) assert.ok(personIds.has(id), `${event.id} names unknown person ${id}`);
  }
});

test('people have a well-formed shape and unique ids', () => {
  const ids = history.people.map(person => person.id);
  assert.equal(new Set(ids).size, ids.length, 'unique person ids');
  for (const person of history.people) {
    const where = `person ${person.id}`;
    assert.ok(ID_PATTERN.test(person.id), `${where}: kebab-case id`);
    assert.ok(nonEmptyString(person.name), `${where}: name`);
    assert.ok(nonEmptyString(person.lifeLabel), `${where}: lifeLabel`);
    for (const key of ['born', 'died']) {
      assert.ok(person[key] === null || Number.isInteger(person[key]), `${where}: ${key} is a year or null`);
    }
    if (person.born !== null && person.died !== null) assert.ok(person.died > person.born, `${where}: died after born`);
    assert.ok(nonEmptyString(person.bio) && person.bio.length <= 400, `${where}: short bio`);
    assert.ok(!/[<>"]/.test(person.bio), `${where}: bio is plain text`);
    assert.ok(Array.isArray(person.knownFor) && person.knownFor.length > 0 && person.knownFor.every(nonEmptyString), `${where}: knownFor`);
    assert.equal(typeof person.inWeProgrammers, 'boolean', `${where}: inWeProgrammers flag`);
  }
});

test('every person appears in at least one event', () => {
  for (const person of history.people) {
    assert.ok(history.eventsForPerson(person.id).length >= 1, `${person.id} is not linked to any event`);
  }
});

test('the people layer includes the key figures', () => {
  const required = ['lovelace', 'turing', 'von-neumann', 'hopper', 'backus', 'dijkstra', 'hoare', 'knuth', 'tarjan',
    'bellman', 'shannon', 'wirth', 'frances-allen', 'liskov', 'margaret-hamilton'];
  for (const id of required) assert.ok(personIds.has(id), `missing ${id}`);
});
