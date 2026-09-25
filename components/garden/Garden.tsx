'use client';

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { SCHOOL } from '@/lib/content';
import { describeFlower } from '@/lib/garden/flowers';
import { GardenBackdrop, SkyPlane } from './GardenBackdrop';
import { GardenRenderer, type CameraState, type Selection } from '@/lib/garden/renderer';
import type { FlowerColor, FlowerKind, FlowerType, Planting, Slot, Teacher } from '@/lib/garden/types';
import { fullName } from '@/lib/names';

export interface GardenHandle {
  /** Приблизить и подсветить цветок. */
  focusPlanting: (id: number) => void;
  /** Показать клумбу целиком. */
  fit: () => void;
  /** Вернуться к стартовому виду. */
  home: () => void;
  /** Показать и подсветить подсолнух в центре (цветок директора). */
  focusEmblem: () => void;
}

interface GardenProps {
  plantings: Planting[];
  flowers: FlowerType[];
  teachers: Teacher[];
  colors: FlowerColor[];
  /** false, пока данные ещё загружаются: первый набор рисуется без анимации роста. */
  loaded?: boolean;
  /** цветок, который нужно подсветить кольцом (например, только что посаженный) */
  highlightId?: number | null;
  /** свободные места — включает режим выбора места */
  pickSlots?: Slot[] | null;
  /** выбранное место и цветок-«призрак» на нём */
  chosen?: { slot: Slot; kind: FlowerKind; color: string } | null;
  onPickSlot?: (slot: Slot) => void;
  /** показать яркими только цветы этого учителя */
  focusTeacherId?: number | null;
  /** элементы поверх клумбы (панель выбора места и т. п.) */
  overlay?: ReactNode;
  /** Режим большого экрана: без кнопок, счётчика и подсказки — их рисует сам экран. */
  screen?: boolean;
  ref?: Ref<GardenHandle>;
}

export function Garden({
  plantings,
  flowers,
  teachers,
  colors,
  loaded = true,
  highlightId = null,
  pickSlots = null,
  chosen = null,
  onPickSlot,
  focusTeacherId = null,
  overlay,
  screen = false,
  ref,
}: GardenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GardenRenderer | null>(null);
  const seen = useRef<Set<number>>(new Set());
  const initialised = useRef(false);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [camera, setCamera] = useState<CameraState | null>(null);

  const kinds = useMemo(() => new Map(flowers.map((f) => [f.id, f.kind])), [flowers]);
  const kindsRef = useRef(kinds);
  kindsRef.current = kinds;
  const flowerById = useMemo(() => new Map(flowers.map((f) => [f.id, f])), [flowers]);
  const teacherById = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const colorByHex = useMemo(() => new Map(colors.map((c) => [c.hex.toUpperCase(), c])), [colors]);

  const onPickRef = useRef(onPickSlot);
  onPickRef.current = onPickSlot;

  // создание рендерера
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new GardenRenderer({
      canvas,
      resolveKind: (id) => kindsRef.current.get(id) ?? 'tulip',
      onSelect: setSelection,
      onCamera: setCamera,
      onPickSlot: (slot) => onPickRef.current?.(slot),
      // самолёт летит в небе мира клумбы: сдвигаем и масштабируем его слой вместе с камерой
      onView: ({ cx, cy, zoom, vw, vh }) => {
        const el = planeRef.current;
        if (!el) return;
        const t = `translate(${(vw / 2 - cx * zoom).toFixed(1)}px, ${(vh / 2 - cy * zoom).toFixed(1)}px) scale(${zoom.toFixed(4)})`;
        if (el.style.transform !== t) el.style.transform = t;
      },
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    rendererRef.current = renderer;

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => renderer.setEmblem(img);
    img.src = SCHOOL.emblem;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
      seen.current = new Set();
      initialised.current = false;
    };
  }, []);

  // синхронизация цветов: первый набор — сразу, новые — с анимацией роста
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (!initialised.current) {
      if (!loaded) return;
      renderer.setPlantings(plantings);
      seen.current = new Set(plantings.map((p) => p.id));
      initialised.current = true;
      return;
    }
    // цветы могли и пропасть (администратор удалил учителя) — тогда перерисовываем набор целиком
    const ids = new Set(plantings.map((p) => p.id));
    let removed = false;
    for (const id of seen.current) {
      if (!ids.has(id)) {
        removed = true;
        break;
      }
    }
    if (removed) {
      const fresh = plantings.filter((p) => !seen.current.has(p.id));
      const old = plantings.filter((p) => seen.current.has(p.id));
      renderer.setPlantings(old);
      for (const p of fresh) renderer.add(p, true);
      seen.current = ids;
      return;
    }
    for (const p of plantings) {
      if (!seen.current.has(p.id)) {
        seen.current.add(p.id);
        renderer.add(p, true);
      }
    }
  }, [plantings, loaded]);

  useEffect(() => {
    if (highlightId != null) rendererRef.current?.highlightPlanting(highlightId);
  }, [highlightId]);

  // режим выбора места
  const picking = pickSlots !== null;
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.setPickMode(pickSlots);
    if (pickSlots) {
      r.ensureZoom(0.6); // на телефоне приближаем, чтобы точки можно было выбрать пальцем
      setSelection(null);
    }
  }, [pickSlots]);

  useEffect(() => {
    rendererRef.current?.setChosen(chosen?.slot ?? null, chosen?.kind, chosen?.color);
  }, [chosen]);

  useEffect(() => {
    rendererRef.current?.setFocusTeacher(focusTeacherId);
  }, [focusTeacherId]);

  useImperativeHandle(
    ref,
    () => ({
      focusPlanting: (id: number) => {
        rendererRef.current?.highlightPlanting(id);
        rendererRef.current?.focusOn(id, 2.6);
      },
      fit: () => rendererRef.current?.fitView(),
      home: () => rendererRef.current?.homeView(),
      focusEmblem: () => {
        rendererRef.current?.highlightEmblem();
        rendererRef.current?.focusEmblem();
      },
    }),
    [],
  );

  const zoomIn = () => rendererRef.current?.zoomBy(1.5);
  const zoomOut = () => rendererRef.current?.zoomBy(1 / 1.5);
  const fitAll = () => rendererRef.current?.fitView();
  const canZoomIn = !camera || camera.zoom < camera.maxZoom * 0.995;
  const canZoomOut = !camera || camera.zoom > camera.fit * 1.005;

  // подсказка над цветком: ФИО учителя, предмет, цветок и его цвет
  let tip: { title: string; sub: string; color?: string; director?: boolean } | null = null;
  const director = teachers.find((t) => t.isDirector) ?? null;
  if (selection?.type === 'planting') {
    const p = selection.planting;
    const t = teacherById.get(p.teacherId);
    const f = flowerById.get(p.flowerId);
    const c = colorByHex.get(p.color.toUpperCase());
    const what = f ? (c ? describeFlower(c.name, f.kind, f.name) : f.name.toLowerCase()) : 'цветок';
    tip = t
      ? { title: fullName(t), sub: `${t.subject} · ${what}`, color: t.color, director: t.isDirector }
      : { title: 'Цветок', sub: what };
  } else if (selection?.type === 'emblem') {
    tip = director
      ? { title: fullName(director), sub: 'Директор школы · главный подсолнух клумбы', color: director.color, director: true }
      : { title: 'Символ нашей школы', sub: 'Подсолнух ОК10' };
  }
  const stageWidth = canvasRef.current?.clientWidth ?? 0;
  const tipLeft = selection ? Math.min(Math.max(selection.x, 110), Math.max(stageWidth - 110, 110)) : 0;

  return (
    <div className={screen ? 'garden garden--screen' : 'garden'}>
      <div className="garden__stage" id="garden-stage" data-picking={picking ? 'true' : undefined}>
        <GardenBackdrop />
        <canvas
          ref={canvasRef}
          className="garden__canvas"
          tabIndex={0}
          role="img"
          aria-label={`Общая клумба: посажено цветов — ${plantings.length}. Стрелки двигают вид, плюс и минус меняют масштаб.`}
        />
        <SkyPlane ref={planeRef} />

        {screen ? null : (
        <>
        <p className="garden__count" aria-live="polite">
          <span aria-hidden="true">🌷</span>
          <span className="sr-only">Посажено цветов:</span>
          <strong>{loaded ? plantings.length : '—'}</strong>
        </p>

        <div className="garden__controls" role="group" aria-label="Масштаб клумбы">
          <button type="button" onClick={zoomIn} disabled={!canZoomIn} aria-label="Приблизить">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" onClick={zoomOut} disabled={!canZoomOut} aria-label="Отдалить">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          <button type="button" onClick={fitAll} disabled={!canZoomOut} aria-label="Показать всю клумбу">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          </button>
        </div>
        </>
        )}

        {selection && tip && !picking ? (
          <div
            className={`garden__tip${selection.y < 96 ? ' garden__tip--below' : ''}${tip.director ? ' garden__tip--director' : ''}`}
            style={{ left: tipLeft, top: selection.y }}
            role="status"
          >
            <strong>
              {tip.color ? <i className="garden__tip-dot" style={{ background: tip.color }} aria-hidden="true" /> : null}
              {tip.director ? '🌻 ' : ''}
              {tip.title}
            </strong>
            <span>{tip.sub}</span>
          </div>
        ) : null}

        {overlay}
      </div>

      {screen ? null : (
      <p className="garden__hint">
        <span className="hint-fine">Нажмите на цветок, чтобы узнать, для какого он учителя. Приближение: кнопки, двойной клик или Ctrl + колесо.</span>
        <span className="hint-coarse">Коснитесь цветка, чтобы узнать, для какого он учителя. Приближайте двумя пальцами.</span>
      </p>
      )}
    </div>
  );
}
