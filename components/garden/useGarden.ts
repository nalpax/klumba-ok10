'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { DEFAULT_CLOSING, type ClosingContent, type EventStatus } from '@/lib/content';
import type { FlowerColor, FlowerType, Planting, Teacher } from '@/lib/garden/types';

export interface GardenData {
  loaded: boolean;
  demo: boolean;
  status: EventStatus;
  closing: ClosingContent;
  teachers: Teacher[];
  flowers: FlowerType[];
  colors: FlowerColor[];
  plantings: Planting[];
  /** Добавить цветок, не дожидаясь realtime (например, сразу после ответа сервера на посадку). */
  addPlanting: (p: Planting) => void;
}

/**
 * Свежий снимок с сервера главнее того, что уже было на странице: так пропадают удалённые цветы.
 * Сохраняем только цветы новее снимка (пришли, пока снимок был в пути).
 */
function replaceWithSnapshot(snap: Planting[], prev: Planting[]): Planting[] {
  const maxId = snap.reduce((m, p) => Math.max(m, p.id), 0);
  const newer = prev.filter((p) => p.id > maxId);
  return newer.length ? [...snap, ...newer] : snap;
}

function merge(base: Planting[], extra: Planting[]): Planting[] {
  const seen = new Set(base.map((p) => p.id));
  const add = extra.filter((p) => !seen.has(p.id));
  return add.length ? [...base, ...add] : base;
}

/** Загружает клумбу и подписывается на новые цветы. Всё общение с бэкендом — через lib/api. */
export function useGarden(): GardenData {
  const [state, setState] = useState<Omit<GardenData, 'plantings' | 'addPlanting'>>({
    loaded: false,
    demo: false,
    status: 'open',
    closing: DEFAULT_CLOSING,
    teachers: [],
    flowers: [],
    colors: [],
  });
  const [plantings, setPlantings] = useState<Planting[]>([]);

  useEffect(() => {
    const api = getApi();
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const reload = (): Promise<void> =>
      api
        .load()
        .then((snap) => {
          if (!alive) return;
          setState({
            loaded: true,
            demo: api.mode === 'demo',
            status: snap.status,
            closing: snap.closing,
            teachers: snap.teachers,
            flowers: snap.flowers,
            colors: snap.colors,
          });
          setPlantings((prev) => replaceWithSnapshot(snap.plantings, prev));
        })
        .catch(() => {
          // нет связи — пробуем ещё раз через несколько секунд
          if (alive) retry = setTimeout(reload, 5000);
        });

    // подписываемся сразу: цветы, пришедшие во время загрузки, не потеряются
    const unsubscribe = api.subscribe((p) => {
      if (alive) setPlantings((prev) => merge(prev, [p]));
    });
    // статус мероприятия или список учителей изменил администратор — обновляем со страницы
    const unsubscribeMeta = api.subscribeMeta(() => {
      if (alive) reload();
    });

    reload();

    return () => {
      alive = false;
      if (retry) clearTimeout(retry);
      unsubscribe();
      unsubscribeMeta();
    };
  }, []);

  const addPlanting = useCallback((p: Planting) => setPlantings((prev) => merge(prev, [p])), []);

  return { ...state, plantings, addPlanting };
}

/** Лёгкая версия для мест, которым нужен только статус мероприятия (например, первый экран). */
export function useEventStatus(initial: EventStatus = 'open'): EventStatus {
  const [status, setStatus] = useState<EventStatus>(initial);

  useEffect(() => {
    const api = getApi();
    let alive = true;
    const apply = () =>
      api
        .load()
        .then((snap) => alive && setStatus(snap.status))
        .catch(() => {});
    apply();
    const unsub = api.subscribeMeta(apply);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return status;
}
