import type { ClosingContent, EventStatus } from '@/lib/content';
import type { FlowerColor, FlowerType, Planting, Slot, Teacher } from '@/lib/garden/types';

/**
 * Единый интерфейс «бэкенда» для сайта. Две реализации с одинаковыми правилами (lib/core/engine.ts):
 * lib/api/live.ts — настоящий сервер (app/api), lib/api/demo.ts — демо в памяти браузера.
 */
export type ApiError =
  | 'closed'
  | 'not_open'
  | 'rate_limited'
  | 'invalid_code'
  | 'code_used'
  | 'not_student_code'
  | 'invalid_choice'
  | 'slot_taken'
  | 'garden_full'
  | 'forbidden'
  | 'validation'
  | 'director'
  | 'unauthorized'
  | 'network';

export interface TeacherInfo {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
  subject: string;
  photoUrl: string | null;
  isDirector?: boolean;
}

export type LoginResult =
  | { ok: false; error: ApiError }
  | { ok: true; role: 'student'; status: 'unused' }
  | { ok: true; role: 'student'; status: 'used'; planting: Planting | null }
  | { ok: true; role: 'teacher'; teacher: TeacherInfo; planted: number; opened: boolean }
  /** token — ключ сессии администратора: с ним идут все admin-запросы. Само слово-пароль в браузере не хранится. */
  | { ok: true; role: 'admin'; token: string };

export interface PlantInput {
  code: string;
  teacherId: number;
  flowerId: number;
  color: string;
  slotId: number;
}

export type PlantResult = { ok: false; error: ApiError } | { ok: true; planting: Planting };

export type CardResult = { ok: false; error: ApiError } | { ok: true; wish: string; planted: number };

export interface GardenSnapshot {
  status: EventStatus;
  closing: ClosingContent;
  teachers: Teacher[];
  flowers: FlowerType[];
  colors: FlowerColor[];
  plantings: Planting[];
  /** версия метаданных (см. GardenState.version) */
  version: number;
}

/** Данные формы «добавить/изменить учителя» в админке. id — только при редактировании. */
export interface TeacherInput {
  id?: number;
  firstName: string;
  middleName: string;
  lastName: string;
  subject: string;
  color: string;
  flowerIds: number[];
  /** Личное пожелание для открытки. Пусто — покажется один из запасных текстов (см. lib/wishes.ts). */
  wish: string;
  isDirector?: boolean;
}

export interface AdminStats {
  plantings: number;
  studentCodesTotal: number;
  studentCodesUsed: number;
  teacherCodesTotal: number;
  slotsTotal: number;
  slotsFree: number;
  teachersWithoutWish: number;
  byTeacher: Record<number, number>;
}

export type AdminResult = { ok: false; error: ApiError } | { ok: true };
/** code — только при создании нового учителя: личный код для входа, его нужно сразу сохранить. */
export type AdminTeacherResult = { ok: false; error: ApiError } | { ok: true; teacher: Teacher; code?: string };

export interface Api {
  mode: 'demo' | 'live';
  /** Всё, что нужно для первой отрисовки. */
  load(): Promise<GardenSnapshot>;
  /** Новые цветы в реальном времени. Возвращает функцию отписки. */
  subscribe(onPlanting: (p: Planting) => void): () => void;
  /** Вернуть сессию администратора по сохранённому ключу. false — ключ устарел. */
  restoreAdmin(token: string): Promise<boolean>;
  /** Завершить сессию администратора. */
  adminLogout(): Promise<void>;
  /** Свободные места (нужны только в режиме выбора места). */
  freeSlots(): Promise<Slot[]>;
  login(code: string): Promise<LoginResult>;
  plant(input: PlantInput): Promise<PlantResult>;
  /** Личное пожелание учителя. Текст приходит только сюда — до нажатия «Открыть» его на странице нет. */
  openCard(code: string): Promise<CardResult>;

  /** Изменения статуса мероприятия или списка учителей — чтобы обновить открытую страницу. */
  subscribeMeta(onChange: () => void): () => void;
  adminStats(): Promise<AdminStats>;
  adminSetStatus(status: EventStatus): Promise<AdminResult>;
  /** Заголовок, текст и показ статистики на финальном экране (когда посадка завершена). */
  adminSetClosing(closing: ClosingContent): Promise<AdminResult>;
  /** Полные данные учителей для админки (с пожеланием) — публичный load() его не отдаёт. */
  adminListTeachers(): Promise<TeacherInput[]>;
  adminSaveTeacher(input: TeacherInput): Promise<AdminTeacherResult>;
  /** Удаляет учителя вместе со всеми его цветами; коды учеников, чьи цветы пропали, снова становятся свободными. */
  adminDeleteTeacher(id: number): Promise<{ ok: false; error: ApiError } | { ok: true; removed: number }>;
  /** Коды на посадку для класса. Общее число ограничено числом мест на клумбе. */
  adminGenerateStudentCodes(count: number, label: string): Promise<{ ok: true; codes: string[] } | { ok: false; error: ApiError }>;
  /** Личный код учителя для входа. Если код уже был, старый перестаёт действовать. */
  adminGenerateTeacherCode(teacherId: number): Promise<{ ok: true; code: string } | { ok: false; error: ApiError }>;
  /** CSV со всеми кодами — то же самое, что делает admin_export_codes в SQL. */
  adminExportCodes(): Promise<string>;

  /** Только демо: готовые коды для проверки. */
  demoCodes?: { students: string[]; teachers: { code: string; name: string }[]; admin?: string };
}

export const ERROR_TEXT: Record<ApiError, string> = {
  closed: 'Посадка цветов завершена 🌷 Спасибо всем участникам! Теперь вы можете посмотреть нашу общую клумбу.',
  not_open: 'Посадка ещё не началась. Загляните позже.',
  rate_limited: 'Слишком много попыток. Подождите несколько минут и попробуйте снова.',
  invalid_code: 'Код не найден. Проверьте, что вы ввели его правильно.',
  code_used: 'Этот код уже использован.',
  not_student_code: 'Этот код не для посадки цветка.',
  invalid_choice: 'Этот вариант сейчас недоступен. Выберите другой.',
  slot_taken: 'Это место только что заняли. Выберите другое.',
  garden_full: 'На клумбе не осталось свободных мест.',
  forbidden: 'Недостаточно прав для этого действия.',
  validation: 'Проверьте, что все поля заполнены верно.',
  director: 'Директора удалить нельзя — можно только изменить.',
  unauthorized: 'Сессия администратора закончилась. Войдите заново.',
  network: 'Нет связи. Проверьте интернет и попробуйте ещё раз.',
};
