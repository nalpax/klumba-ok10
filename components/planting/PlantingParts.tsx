'use client';

import { FlowerPreview } from '@/components/garden/FlowerPreview';
import { Modal } from '@/components/ui/Modal';
import type { FlowerKind } from '@/lib/garden/types';

interface PlaceBarProps {
  chosen: boolean;
  busy: boolean;
  notice: string | null;
  onPlant: () => void;
  onBack: () => void;
}

/** Панель внизу клумбы на шаге «выберите место». */
export function PlaceBar({ chosen, busy, notice, onPlant, onBack }: PlaceBarProps) {
  return (
    <div className="placebar" role="region" aria-label="Выбор места">
      <p className="placebar__text">
        {notice ? (
          <span className="placebar__notice">{notice}</span>
        ) : chosen ? (
          'Место выбрано. Можно сажать. Или коснитесь другой точки.'
        ) : (
          'Коснитесь светящейся точки на клумбе, где хотите посадить цветок.'
        )}
      </p>
      <div className="placebar__buttons">
        <button type="button" className="btn btn--lime btn--sm" onClick={onPlant} disabled={!chosen || busy}>
          Посадить здесь
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          Назад
        </button>
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  teacherName: string;
  subject: string;
  flowerPhrase: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Последнее подтверждение: после него цветок изменить нельзя. */
export function ConfirmPlanting({ open, teacherName, subject, flowerPhrase, busy, error, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} label="Подтверждение посадки">
      <div className="confirm">
        <h2 className="dialog__title">Вы выбрали</h2>
        <dl className="confirm__list">
          <div>
            <dt>Учитель</dt>
            <dd>
              {teacherName}
              <span>{subject}</span>
            </dd>
          </div>
          <div>
            <dt>Цветок</dt>
            <dd>{flowerPhrase}</dd>
          </div>
        </dl>
        <p className="notice notice--plain">
          <span className="notice__mark" aria-hidden="true">!</span>
          После посадки изменить цветок, цвет, учителя или место будет невозможно. Посадить?
        </p>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="dialog__buttons">
          <button type="button" className="btn btn--lime btn--lg" onClick={onConfirm} disabled={busy}>
            {busy ? 'Сажаем…' : 'Посадить'}
          </button>
          <button type="button" className="btn btn--ghost btn--lg" onClick={onCancel} disabled={busy}>
            Изменить выбор
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ThanksProps {
  open: boolean;
  teacherName: string;
  flowerPhrase: string;
  kind: FlowerKind | null;
  color: string;
  onClose: () => void;
}

/** Благодарность сразу после посадки. */
export function ThanksModal({ open, teacherName, flowerPhrase, kind, color, onClose }: ThanksProps) {
  return (
    <Modal open={open} onClose={onClose} label="Спасибо!">
      <div className="thanks">
        {kind ? (
          <div className="thanks__flower" aria-hidden="true">
            <FlowerPreview kind={kind} color={color} height={150} />
          </div>
        ) : null}
        <h2 className="dialog__title thanks__title">Спасибо! 🌷</h2>
        <p className="thanks__text">
          {flowerPhrase ? <strong>{flowerPhrase}</strong> : 'Ваш цветок'} уже растёт на нашей общей клумбе
          {teacherName ? (
            <>
              {' '}
              — для учителя <strong>{teacherName}</strong>
            </>
          ) : null}
          .
        </p>
        <p className="thanks__sub">
          Вы сказали «спасибо» так, что это видит вся школа. Учитель увидит ваш цветок, когда откроет свою открытку.
        </p>
        <div className="dialog__buttons thanks__buttons">
          <button type="button" className="btn btn--lime btn--lg" onClick={onClose}>
            Посмотреть на клумбе
          </button>
        </div>
      </div>
    </Modal>
  );
}
