import { GardenRenderer } from '../lib/garden/renderer';
import { DEMO_FLOWERS, generateSlots, makeDemoPlantings } from '../lib/garden/demo';

const params = new URLSearchParams(location.search);
const count = Number(params.get('n') || 420);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const kinds = new Map(DEMO_FLOWERS.map((f) => [f.id, f.kind]));
const r = new GardenRenderer({ canvas, resolveKind: (id) => kinds.get(id) ?? 'tulip' });
const slots = generateSlots();
(window as any).slotCount = slots.length;
r.setPlantings(makeDemoPlantings(count, slots));
const img = new Image();
img.src = '/brand/sunflower-ok10.webp';
img.onload = () => r.setEmblem(img);
(window as any).r = r;
(window as any).ready = true;
