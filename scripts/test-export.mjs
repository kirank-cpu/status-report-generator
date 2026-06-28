// Smoke test: generate a sample deck via Node to validate the export logic.
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { makeInitialState, makeSquad, makeCustomSlide } = await import('../src/constants.js');
const { exportPptx } = await import('../src/export/exportPptx.js');

const state = makeInitialState();
const squad2 = makeSquad('Payments Squad');
squad2.features[0].name = 'Direct Debit Setup';
squad2.features[0].userStories = 5;
squad2.features[0].designed = 20;
squad2.features[0].executed = 18;
squad2.features[0].testPass = 15;
squad2.features[0].testFail = 2;
squad2.features[0].testBlocked = 1;
squad2.features[0].preprodPass = 15;
squad2.features[0].preprodFail = 0;
squad2.features[0].preprodBlocked = 0;
squad2.defects[0].open = 1;
const custom = makeCustomSlide();
custom.title = 'Automation Progress';
custom.body = 'Framework upgraded to Playwright 1.50\n  120 scripts migrated\n  Nightly run green for 2 weeks\nNext: API test pack';
squad2.customSlides.push(custom);
state.teams[0].projects[0].squads.push(squad2);

await exportPptx(state);
console.log('Export completed OK');
