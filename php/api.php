<?php
/**
 * Сервер клумбы для обычного PHP-хостинга. Те же правила и те же ответы, что у Node-сервера
 * (app/api/[action]/route.ts + lib/core/engine.ts), поэтому страница работает с ним без изменений.
 *
 * Данные — один JSON-файл. Каждый запрос, который что-то меняет, держит блокировку файла (flock),
 * поэтому две одновременные посадки с одним кодом или на одно место пройти не могут.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

/**
 * Настройки читаем из config.php как текст, а не выполняем его: если при правке файла
 * случайно сломать кавычку или скобку, сайт всё равно продолжит работать.
 */
function configValue(string $name): string
{
    $m = configMatch($name);
    return $m === null ? '' : $m;
}

/** Текст config.php в UTF-8 (редактор хостинга может сохранить файл в Windows-1251). */
function configText(): string
{
    static $text = null;
    if ($text === null) {
        $text = (string) @file_get_contents(__DIR__ . '/config.php');
        if (strncmp($text, "\xEF\xBB\xBF", 3) === 0) $text = substr($text, 3);
        if (!preg_match('//u', $text)) {
            $conv = function_exists('iconv') ? @iconv('CP1251', 'UTF-8//IGNORE', $text) : false;
            if ($conv === false && function_exists('mb_convert_encoding')) $conv = mb_convert_encoding($text, 'UTF-8', 'CP1251');
            $text = $conv === false ? '' : $conv;
        }
        // некоторые онлайн-редакторы сохраняют кавычки как &#039; или &quot;
        if (strpos($text, '&') !== false) $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    return $text;
}

/**
 * «Скелет» config.php для самопроверки: всё, что в кавычках (кроме названий настроек), и любые
 * слова вне комментариев заменены точками — видно, как устроен файл, но не видно пароля.
 */
function configPreview(): array
{
    $out = [];
    foreach (preg_split('/\R/u', configText()) as $line) {
        $t = ltrim($line);
        if ($t === '' || $t[0] === '*' || strncmp($t, '/*', 2) === 0 || strncmp($t, '//', 2) === 0) continue;
        $masked = preg_replace_callback('/([\'"«»“”„`’‘])(.*?)([\'"«»“”„`’‘])/u', function ($m) {
            return in_array($m[2], ['ADMIN_PASSWORD', 'KLUMBA_DATA_DIR'], true) ? $m[0] : $m[1] . ($m[2] === '' ? '' : '•••') . $m[3];
        }, $line);
        $masked = preg_replace_callback('/[^\s()\[\]{};,=\'"«»“”„`’‘<>?•]+/u', function ($m) {
            return in_array($m[0], ['define', 'php', 'ADMIN_PASSWORD', 'KLUMBA_DATA_DIR'], true) ? $m[0] : '•••';
        }, $masked);
        $out[] = mb_substr($masked, 0, 120);
        if (count($out) >= 12) break;
    }
    return $out;
}

/**
 * Значение настройки из строки, где есть её название, или null, если такой строки нет.
 * Читаем как можно мягче: после названия отбрасываем любые кавычки (в том числе «умные» ’ ‘ “ ” « »),
 * запятые, скобки и точку с запятой — остаётся сам пароль. Строки-комментарии пропускаем.
 */
function configMatch(string $name): ?string
{
    $junk = "\\s'\"`’‘‚′“”„«»,;()";
    foreach (preg_split('/\R/u', configText()) as $line) {
        $t = ltrim($line);
        if ($t === '' || $t[0] === '*' || strncmp($t, '//', 2) === 0 || $t[0] === '#' || strncmp($t, '/*', 2) === 0) continue;
        $i = strpos($line, $name);
        if ($i === false) continue;
        $rest = substr($line, $i + strlen($name));
        $rest = preg_replace('/^[' . $junk . ']+|[' . $junk . ']+$/u', '', $rest);
        return (string) $rest;
    }
    return null;
}

// Если на хостинге нет расширения mbstring — простые замены (для кириллицы и латиницы этого достаточно).
if (!function_exists('mb_strtoupper')) {
    function mb_chars(string $s): array
    {
        preg_match_all('/./us', $s, $m);
        return $m[0];
    }
    function mb_strtoupper(string $s, $enc = null): string
    {
        $lo = mb_chars('абвгдеёжзийклмнопрстуфхцчшщъыьэюя');
        $up = mb_chars('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ');
        return strtoupper(str_replace($lo, $up, $s));
    }
    function mb_strtolower(string $s, $enc = null): string
    {
        $lo = mb_chars('абвгдеёжзийклмнопрстуфхцчшщъыьэюя');
        $up = mb_chars('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ');
        return strtolower(str_replace($up, $lo, $s));
    }
    function mb_strlen(string $s, $enc = null): int
    {
        return count(mb_chars($s));
    }
    function mb_substr(string $s, int $start, ?int $len = null, $enc = null): string
    {
        return implode('', array_slice(mb_chars($s), $start, $len));
    }
}

set_error_handler(function ($no, $msg, $file, $line) {
    journal('PHP предупреждение: ' . $msg . ' (строка ' . $line . ')');
    return true;
});
register_shutdown_function(function () {
    $e = error_get_last();
    if (empty($GLOBALS['__klumba_done']) && $e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        journal('PHP ОШИБКА (' . ($_GET['action'] ?? '') . '): ' . $e['message'] . ' (строка ' . $e['line'] . ')');
        if (!headers_sent()) http_response_code(500);
        echo '{"ok":false,"error":"network"}';
    }
});

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const CODE_ALPHABET = 'ACDEFHJKMNPRTWXY3479';
const CODE_LENGTH = 10;
const MAX_CODES_PER_BATCH = 500;
const MAX_TEXT = 2000;
const CODE_LIMIT = 60;          // неудачных вводов кода за 10 минут с одного адреса
const CODE_WINDOW = 600;
const ADMIN_LIMIT = 10;         // неудачных вводов пароля за 15 минут
const ADMIN_WINDOW = 900;
const SESSION_S = 14 * 24 * 3600;
const MAX_BODY = 32768;
const BACKUP_EVERY_S = 600;

/* ------------------------------------ вывод ------------------------------------ */

/** Журнал для самопроверки: какие запросы пришли и чем закончились (без тел запросов и паролей). */
function journal(string $line): void
{
    static $dir = false;
    if ($dir === false) {
        $dir = null;
        foreach ([configValue('KLUMBA_DATA_DIR'), getenv('KLUMBA_DATA_DIR') ?: '', dirname(__DIR__) . '/klumba-data', __DIR__ . '/klumba-lib/data'] as $c) {
            if ($c !== '' && is_dir($c) && is_writable($c)) {
                $dir = $c;
                break;
            }
        }
    }
    if ($dir === null) return;
    $f = $dir . '/journal.log';
    if (is_file($f) && filesize($f) > 200000) @rename($f, $f . '.old');
    @file_put_contents($f, date('d.m H:i:s') . ' ' . $line . "\n", FILE_APPEND | LOCK_EX);
}

function journalTail(int $n): array
{
    $f = dataDir() . '/journal.log';
    if (!is_file($f)) return [];
    $lines = file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    return array_slice($lines, -$n);
}

function out($data, int $status = 200): void
{
    $action = (string) ($_GET['action'] ?? '');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    if ($json === false) {
        journal("$action: ошибка json_encode: " . json_last_error_msg());
        $status = 500;
        $json = '{"ok":false,"error":"network"}';
    }
    if (!in_array($action, ['check', 'updates', 'health'], true)) {
        $err = is_array($data) && isset($data['error']) ? ' ' . $data['error'] : '';
        journal(($_SERVER['REQUEST_METHOD'] ?? '?') . " $action → $status$err");
    }
    $GLOBALS['__klumba_done'] = true;
    http_response_code($status);
    echo $json;
    exit;
}

function fail(string $error): array
{
    return ['ok' => false, 'error' => $error];
}

/* ------------------------------------ хранилище ------------------------------------ */

/** Папка данных: по возможности вне public_html, чтобы файл нельзя было скачать по ссылке. */
function dataDir(): string
{
    static $dir = null;
    if ($dir !== null) return $dir;
    $candidates = [];
    if (configValue('KLUMBA_DATA_DIR') !== '') $candidates[] = configValue('KLUMBA_DATA_DIR');
    if (getenv('KLUMBA_DATA_DIR')) $candidates[] = getenv('KLUMBA_DATA_DIR');
    $candidates[] = dirname(__DIR__) . '/klumba-data';
    $candidates[] = __DIR__ . '/klumba-lib/data';
    foreach ($candidates as $c) {
        if ((is_dir($c) || @mkdir($c, 0700, true)) && is_writable($c)) {
            return $dir = $c;
        }
    }
    out(['ok' => false, 'error' => 'network', 'message' => 'Нет папки для данных с правом записи'], 500);
}

function catalog(): array
{
    static $cat = null;
    if ($cat === null) {
        $cat = json_decode((string) file_get_contents(__DIR__ . '/klumba-lib/catalog.json'), true);
    }
    return $cat;
}

function slotById(int $id): ?array
{
    static $byId = null;
    if ($byId === null) {
        $byId = [];
        foreach (catalog()['slots'] as $s) $byId[$s['id']] = $s;
    }
    return $byId[$id] ?? null;
}

function flowerById(int $id): ?array
{
    foreach (catalog()['flowers'] as $f) if ($f['id'] === $id) return $f;
    return null;
}

/** Открывает хранилище с блокировкой: общей для чтения, исключительной для изменений. */
function openStore(bool $write)
{
    $lock = fopen(dataDir() . '/klumba.lock', 'c');
    flock($lock, $write ? LOCK_EX : LOCK_SH);
    return $lock;
}

function loadState(): array
{
    $file = dataDir() . '/klumba.json';
    if (is_file($file)) {
        $s = json_decode((string) file_get_contents($file), true);
        if (is_array($s) && isset($s['teachers'])) {
            $s['studentCodes'] = $s['studentCodes'] ?? [];
            $s['teacherCodes'] = $s['teacherCodes'] ?? [];
            // клумба, созданная до нынешнего списка предметных областей (только директор или прежний
            // список, по которому ещё не сажали и не выдавали коды), получает актуальный список один раз
            if (($s['areasVersion'] ?? 0) < 2) {
                if (onlyOldDefaults($s)) {
                    $s['teachers'] = array_values(array_filter($s['teachers'], function ($t) { return !empty($t['isDirector']); }));
                    foreach (catalog()['empty']['teachers'] as $t) {
                        if (empty($t['isDirector'])) {
                            $t['id'] = $s['nextTeacherId']++;
                            $s['teachers'][] = $t;
                        }
                    }
                    $s['version']++;
                }
                unset($s['areasSeeded']);
                $s['areasVersion'] = 2;
            }
            return $s;
        }
        // файл испорчен — пробуем резервную копию
        $b = dataDir() . '/klumba.backup.json';
        if (is_file($b)) {
            $s = json_decode((string) file_get_contents($b), true);
            if (is_array($s) && isset($s['teachers'])) return $s;
        }
    }
    return getenv('KLUMBA_SEED_DEMO') === '1' ? catalog()['demo'] : catalog()['empty'];
}

/** Только директор и области из прежнего списка, без цветов и кодов для них. */
function onlyOldDefaults(array $s): bool
{
    $old = ['Математика и информатика', 'Русский язык и литература', 'Иностранные языки', 'Общественно-научные предметы',
        'Естественно-научные предметы', 'Начальная школа', 'Искусство и технология', 'Физическая культура и ОБЗР'];
    if (!empty($s['areasSeeded']) && count($s['teachers']) === 1) return false; // директор один по решению админа
    foreach ($s['teachers'] as $t) {
        if (!empty($t['isDirector'])) continue;
        if (!in_array($t['lastName'], $old, true)) return false;
        if (plantedFor($s, $t['id']) > 0 || in_array($t['id'], array_map('intval', array_values($s['teacherCodes'])), true)) return false;
    }
    return true;
}

function atomicWrite(string $file, string $data): void
{
    $tmp = $file . '.' . getmypid() . '.tmp';
    file_put_contents($tmp, $data);
    rename($tmp, $file);
}

/**
 * Быстрый путь для опроса «что нового» (каждый открытый телефон — раз в 4 секунды):
 * если после последнего сохранения ничего не менялось, хватает маленького meta.json.
 * null — готовых файлов нет или они старее основного (тогда читаем всё как обычно).
 */
function freshCache(string $name)
{
    $dir = dataDir();
    $main = $dir . '/klumba.json';
    $f = $dir . '/' . $name;
    clearstatcache();
    if (!is_file($f) || !is_file($main) || filemtime($f) < filemtime($main)) return null;
    return $f;
}

function saveState(array $s): void
{
    $dir = dataDir();
    $file = $dir . '/klumba.json';
    // пустые словари должны остаться объектами {}, а не массивами []
    $s['studentCodes'] = (object) $s['studentCodes'];
    $s['teacherCodes'] = (object) $s['teacherCodes'];
    atomicWrite($file, json_encode($s, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
    // готовые ответы для частых запросов: клумба целиком и «что нового» — без разбора большого файла
    $s['studentCodes'] = [];
    $s['teacherCodes'] = [];
    $lastId = 0;
    foreach ($s['plantings'] as $p) if ($p['id'] > $lastId) $lastId = $p['id'];
    atomicWrite($dir . '/public.json', json_encode(snapshot($s), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION));
    atomicWrite($dir . '/meta.json', json_encode(['version' => $s['version'], 'lastId' => $lastId, 'count' => count($s['plantings'])]));
    $b = $dir . '/klumba.backup.json';
    if (!is_file($b) || time() - filemtime($b) > BACKUP_EVERY_S) @copy($file, $b);
}

function secretKey(): string
{
    $f = dataDir() . '/secret.key';
    if (is_file($f)) return trim((string) file_get_contents($f));
    $k = bin2hex(random_bytes(32));
    file_put_contents($f, $k);
    @chmod($f, 0600);
    return $k;
}

/* ------------------------------------ коды ------------------------------------ */

function normalizeCode(string $input): string
{
    static $look = ['А' => 'A', 'В' => 'B', 'Е' => 'E', 'К' => 'K', 'М' => 'M', 'Н' => 'H', 'О' => 'O', 'Р' => 'P', 'С' => 'C', 'Т' => 'T', 'Х' => 'X', 'У' => 'Y'];
    $up = mb_strtoupper($input, 'UTF-8');
    $up = preg_replace('/[\s\-_.–—]/u', '', $up);
    return strtr($up, $look);
}

function formatCode(string $code): string
{
    $n = normalizeCode($code);
    return mb_strlen($n) > 5 ? mb_substr($n, 0, 5) . '-' . mb_substr($n, 5) : $n;
}

function isValidCodeShape(string $n): bool
{
    return (bool) preg_match('/^[' . CODE_ALPHABET . ']{' . CODE_LENGTH . '}$/', $n);
}

function newCode(array $s): string
{
    for (;;) {
        $c = '';
        for ($i = 0; $i < CODE_LENGTH; $i++) $c .= CODE_ALPHABET[random_int(0, strlen(CODE_ALPHABET) - 1)];
        if (!array_key_exists($c, $s['studentCodes']) && !array_key_exists($c, $s['teacherCodes'])) return $c;
    }
}

/* ------------------------------------ правила ------------------------------------ */

function bump(array &$s): void
{
    $s['version']++;
}

function toPublic(array $t): array
{
    unset($t['wish']);
    $t['flowerIds'] = array_values($t['flowerIds']);
    return $t;
}

function sortedTeachers(array $s): array
{
    $list = $s['teachers'];
    usort($list, function ($a, $b) {
        $d = (int) !empty($b['isDirector']) - (int) !empty($a['isDirector']);
        if ($d !== 0) return $d;
        $c = strcmp(mb_strtolower(str_replace('ё', 'е', $a['lastName'])), mb_strtolower(str_replace('ё', 'е', $b['lastName'])));
        return $c !== 0 ? $c : $a['id'] - $b['id'];
    });
    return $list;
}

function findTeacher(array $s, int $id): ?array
{
    foreach ($s['teachers'] as $t) if ($t['id'] === $id) return $t;
    return null;
}

function plantedFor(array $s, int $teacherId): int
{
    $n = 0;
    foreach ($s['plantings'] as $p) if ($p['teacherId'] === $teacherId) $n++;
    return $n;
}

function snapshot(array $s): array
{
    return [
        'status' => $s['status'],
        'closing' => $s['closing'],
        'teachers' => array_map('toPublic', sortedTeachers($s)),
        'flowers' => catalog()['flowers'],
        'colors' => catalog()['colors'],
        'plantings' => $s['plantings'],
        'version' => $s['version'],
    ];
}

function takenSlots(array $s): array
{
    $t = [];
    foreach ($s['plantings'] as $p) $t[$p['slotId']] = true;
    return $t;
}

function engineLogin(array $s, string $raw): array
{
    $code = normalizeCode($raw);
    if (!isValidCodeShape($code)) return fail('invalid_code');
    if (array_key_exists($code, $s['teacherCodes'])) {
        $t = findTeacher($s, (int) $s['teacherCodes'][$code]);
        if (!$t) return fail('invalid_code');
        return [
            'ok' => true,
            'role' => 'teacher',
            'teacher' => [
                'id' => $t['id'],
                'firstName' => $t['firstName'],
                'middleName' => $t['middleName'],
                'lastName' => $t['lastName'],
                'subject' => $t['subject'],
                'photoUrl' => $t['photoUrl'] ?? null,
                'isDirector' => !empty($t['isDirector']),
            ],
            'planted' => plantedFor($s, $t['id']),
            'opened' => false,
        ];
    }
    if (!array_key_exists($code, $s['studentCodes'])) return fail('invalid_code');
    $st = $s['studentCodes'][$code];
    if ($st['plantingId'] !== null) {
        $planting = null;
        foreach ($s['plantings'] as $p) if ($p['id'] === $st['plantingId']) $planting = $p;
        return ['ok' => true, 'role' => 'student', 'status' => 'used', 'planting' => $planting];
    }
    if ($s['status'] === 'closed') return fail('closed');
    if ($s['status'] === 'draft') return fail('not_open');
    return ['ok' => true, 'role' => 'student', 'status' => 'unused'];
}

function enginePlant(array &$s, array $in): array
{
    if ($s['status'] !== 'open') return fail($s['status'] === 'closed' ? 'closed' : 'not_open');
    $code = normalizeCode((string) ($in['code'] ?? ''));
    if (array_key_exists($code, $s['teacherCodes'])) return fail('not_student_code');
    if (!array_key_exists($code, $s['studentCodes'])) return fail('invalid_code');
    if ($s['studentCodes'][$code]['plantingId'] !== null) return fail('code_used');

    $teacher = findTeacher($s, (int) ($in['teacherId'] ?? 0));
    $flower = flowerById((int) ($in['flowerId'] ?? 0));
    $color = null;
    foreach (catalog()['colors'] as $c) {
        if (strtoupper($c['hex']) === strtoupper((string) ($in['color'] ?? ''))) $color = $c;
    }
    if (!$teacher || !$flower || !$color || !in_array($flower['id'], $teacher['flowerIds'], true)) return fail('invalid_choice');

    $slot = slotById((int) ($in['slotId'] ?? 0));
    if (!$slot) return fail('slot_taken');
    if (isset(takenSlots($s)[$slot['id']])) return fail('slot_taken');

    $planting = [
        'id' => $s['nextPlantingId']++,
        'teacherId' => $teacher['id'],
        'flowerId' => $flower['id'],
        'color' => $color['hex'],
        'slotId' => $slot['id'],
        'x' => $slot['x'],
        'y' => $slot['y'],
        'scale' => $slot['scale'],
        'rotation' => $slot['rotation'],
        'variant' => $slot['variant'],
        'createdAt' => (int) round(microtime(true) * 1000),
    ];
    $s['plantings'][] = $planting;
    $s['studentCodes'][$code]['plantingId'] = $planting['id'];
    return ['ok' => true, 'planting' => $planting];
}

function engineCard(array $s, string $raw): array
{
    $code = normalizeCode($raw);
    if (!array_key_exists($code, $s['teacherCodes'])) return fail('invalid_code');
    $t = findTeacher($s, (int) $s['teacherCodes'][$code]);
    if (!$t) return fail('invalid_code');
    return ['ok' => true, 'wish' => $t['wish'], 'planted' => plantedFor($s, $t['id'])];
}

function adminStats(array $s): array
{
    $by = [];
    foreach ($s['plantings'] as $p) $by[$p['teacherId']] = ($by[$p['teacherId']] ?? 0) + 1;
    $used = 0;
    foreach ($s['studentCodes'] as $c) if ($c['plantingId'] !== null) $used++;
    $noWish = 0;
    foreach ($s['teachers'] as $t) if (trim($t['wish']) === '') $noWish++;
    $total = count(catalog()['slots']);
    return [
        'plantings' => count($s['plantings']),
        'studentCodesTotal' => count($s['studentCodes']),
        'studentCodesUsed' => $used,
        'teacherCodesTotal' => count($s['teacherCodes']),
        'slotsTotal' => $total,
        'slotsFree' => $total - count(takenSlots($s)),
        'teachersWithoutWish' => $noWish,
        'byTeacher' => (object) $by,
    ];
}

function clean($v, int $max = 80): string
{
    return mb_substr(trim(is_scalar($v) ? (string) $v : ''), 0, $max);
}

function saveTeacher(array &$s, $in): array
{
    if (!is_array($in)) return fail('validation');
    $firstName = clean($in['firstName'] ?? '');
    $lastName = clean($in['lastName'] ?? '');
    $middleName = clean($in['middleName'] ?? '');
    $subject = clean($in['subject'] ?? '', 120);
    $color = is_string($in['color'] ?? null) ? $in['color'] : '';
    $flowerIds = [];
    if (is_array($in['flowerIds'] ?? null)) {
        foreach ($in['flowerIds'] as $id) {
            $id = (int) $id;
            if (flowerById($id) && !in_array($id, $flowerIds, true)) $flowerIds[] = $id;
        }
    }
    $wish = clean($in['wish'] ?? '', MAX_TEXT);
    // у директора — полное имя; у предметной области — только название (lastName) и список предметов
    $editing = isset($in['id']) && $in['id'] !== null ? findTeacher($s, (int) $in['id']) : null;
    if (($editing && !empty($editing['isDirector']) && $firstName === '') || $lastName === '' || $subject === '' || !preg_match('/^#[0-9A-Fa-f]{6}$/', $color) || !$flowerIds) {
        return fail('validation');
    }

    if (isset($in['id']) && $in['id'] !== null) {
        foreach ($s['teachers'] as $i => $t) {
            if ($t['id'] === (int) $in['id']) {
                $s['teachers'][$i] = array_merge($t, compact('firstName', 'middleName', 'lastName', 'subject', 'color', 'flowerIds', 'wish'));
                bump($s);
                return ['ok' => true, 'teacher' => toPublic($s['teachers'][$i])];
            }
        }
        return fail('invalid_choice');
    }

    $t = ['id' => $s['nextTeacherId']++] + compact('firstName', 'middleName', 'lastName', 'subject', 'color', 'flowerIds', 'wish');
    $s['teachers'][] = $t;
    $code = newCode($s);
    $s['teacherCodes'][$code] = $t['id'];
    bump($s);
    return ['ok' => true, 'teacher' => toPublic($t), 'code' => formatCode($code)];
}

function deleteTeacher(array &$s, int $id): array
{
    $t = findTeacher($s, $id);
    if (!$t) return fail('invalid_choice');
    if (!empty($t['isDirector'])) return fail('director');
    $removed = [];
    $keep = [];
    foreach ($s['plantings'] as $p) {
        if ($p['teacherId'] === $id) $removed[$p['id']] = true;
        else $keep[] = $p;
    }
    $s['plantings'] = $keep;
    foreach ($s['studentCodes'] as $c => $st) {
        if ($st['plantingId'] !== null && isset($removed[$st['plantingId']])) $s['studentCodes'][$c]['plantingId'] = null;
    }
    foreach ($s['teacherCodes'] as $c => $tid) if ($tid === $id) unset($s['teacherCodes'][$c]);
    $s['teachers'] = array_values(array_filter($s['teachers'], function ($x) use ($id) { return $x['id'] !== $id; }));
    bump($s);
    return ['ok' => true, 'removed' => count($removed)];
}

function clearPlantings(array &$s): array
{
    $removed = count($s['plantings']);
    $s['plantings'] = [];
    foreach ($s['studentCodes'] as $c => $st) $s['studentCodes'][$c]['plantingId'] = null;
    bump($s);
    return ['ok' => true, 'removed' => $removed];
}

function generateStudentCodes(array &$s, $count, $label): array
{
    $n = is_numeric($count) ? (int) floor((float) $count) : 0;
    if ($n < 1 || $n > MAX_CODES_PER_BATCH) return fail('validation');
    $unused = 0;
    foreach ($s['studentCodes'] as $c) if ($c['plantingId'] === null) $unused++;
    $free = count(catalog()['slots']) - count(takenSlots($s));
    if ($unused + $n > $free) return fail('garden_full');
    $label = clean($label, 60);
    $codes = [];
    for ($i = 0; $i < $n; $i++) {
        $code = newCode($s);
        $s['studentCodes'][$code] = $label !== '' ? ['plantingId' => null, 'label' => $label] : ['plantingId' => null];
        $codes[] = formatCode($code);
    }
    return ['ok' => true, 'codes' => $codes];
}

function generateTeacherCode(array &$s, int $teacherId): array
{
    if (!findTeacher($s, $teacherId)) return fail('invalid_choice');
    foreach ($s['teacherCodes'] as $c => $tid) if ($tid === $teacherId) unset($s['teacherCodes'][$c]);
    $code = newCode($s);
    $s['teacherCodes'][$code] = $teacherId;
    return ['ok' => true, 'code' => formatCode($code)];
}

function csvCell(string $v): string
{
    return preg_match('/[",\n;]/', $v) ? '"' . str_replace('"', '""', $v) . '"' : $v;
}

function exportCodes(array $s): string
{
    $lines = ['code,role,teacher,status,label'];
    foreach ($s['studentCodes'] as $code => $st) {
        $lines[] = implode(',', [formatCode((string) $code), 'student', '', $st['plantingId'] !== null ? 'USED' : 'UNUSED', csvCell($st['label'] ?? '')]);
    }
    foreach ($s['teacherCodes'] as $code => $tid) {
        $t = findTeacher($s, (int) $tid);
        $name = $t ? trim($t['lastName'] . ' ' . $t['firstName'] . ' ' . $t['middleName']) : '';
        $lines[] = implode(',', [formatCode((string) $code), $t && !empty($t['isDirector']) ? 'director' : 'teacher', csvCell($name), '-', '']);
    }
    return implode("\n", $lines);
}

/* --------------------------------- безопасность --------------------------------- */

function adminPassword(): ?string
{
    $pw = configValue('ADMIN_PASSWORD');
    if ($pw === '' && getenv('ADMIN_PASSWORD')) $pw = trim((string) getenv('ADMIN_PASSWORD'));
    return $pw === '' ? null : $pw;
}

function normalizeWord(string $w): string
{
    return mb_strtoupper(trim($w), 'UTF-8');
}

function checkAdminPassword(string $input): bool
{
    $pw = adminPassword();
    if ($pw === null) return false;
    return hash_equals(hash('sha256', normalizeWord($pw)), hash('sha256', normalizeWord($input)));
}

function signToken(string $payload): string
{
    // пароль входит в подпись: если его сменить, все старые сессии перестают действовать
    $raw = hash_hmac('sha256', $payload . '|' . (adminPassword() ?? ''), secretKey(), true);
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function issueAdminToken(): string
{
    $payload = 'admin.' . ((time() + SESSION_S) * 1000);
    return $payload . '.' . signToken($payload);
}

function verifyAdminToken(?string $token): bool
{
    if (!$token || adminPassword() === null) return false;
    $i = strrpos($token, '.');
    if ($i === false) return false;
    $payload = substr($token, 0, $i);
    if (!hash_equals(signToken($payload), substr($token, $i + 1))) return false;
    $exp = (int) (explode('.', $payload)[1] ?? 0);
    return $exp > time() * 1000;
}

function adminTokenFromRequest(): ?string
{
    foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $k) {
        if (!empty($_SERVER[$k]) && strncmp($_SERVER[$k], 'Bearer ', 7) === 0) return substr($_SERVER[$k], 7);
    }
    if (!empty($_SERVER['HTTP_X_ADMIN_TOKEN'])) return $_SERVER['HTTP_X_ADMIN_TOKEN'];
    // запасной путь: ключ в теле запроса (если хостинг отрезает заголовки)
    global $body;
    return is_array($body) && is_string($body['_token'] ?? null) ? $body['_token'] : null;
}

function clientIp(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'local';
}

/** Счётчик неудачных попыток по адресу (хранится рядом с данными). */
function limits(callable $fn)
{
    $f = dataDir() . '/limits.json';
    $h = fopen($f, 'c+');
    flock($h, LOCK_EX);
    $data = json_decode((string) stream_get_contents($h), true) ?: [];
    $now = time();
    foreach ($data as $k => $b) if ($b['reset'] <= $now) unset($data[$k]);
    $res = $fn($data, $now);
    ftruncate($h, 0);
    rewind($h);
    fwrite($h, json_encode((object) $data));
    fclose($h);
    return $res;
}

function isLimited(string $key, int $limit): bool
{
    return limits(function (array &$d, int $now) use ($key, $limit) {
        return isset($d[$key]) && $d[$key]['reset'] > $now && $d[$key]['count'] >= $limit;
    });
}

function registerFailure(string $key, int $window): void
{
    limits(function (array &$d, int $now) use ($key, $window) {
        if (!isset($d[$key])) $d[$key] = ['count' => 1, 'reset' => $now + $window];
        else $d[$key]['count']++;
    });
}

/* ------------------------------------ запрос ------------------------------------ */

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && ($action === 'updates' || $action === 'garden' || $action === 'health')) {
    $lock = openStore(false);
    $meta = freshCache('meta.json');
    $meta = $meta ? json_decode((string) file_get_contents($meta), true) : null;
    if (is_array($meta)) {
        if ($action === 'health') out(['ok' => true, 'plantings' => $meta['count'], 'server' => 'php']);
        if ($action === 'updates' && (int) ($_GET['after'] ?? 0) >= $meta['lastId']) {
            out(['version' => $meta['version'], 'plantings' => []]);
        }
        $pub = freshCache('public.json');
        if ($action === 'garden' && $pub) {
            $GLOBALS['__klumba_done'] = true;
            header('Content-Length: ' . filesize($pub));
            readfile($pub);
            exit;
        }
    }
    flock($lock, LOCK_UN);
}

if ($method === 'GET') {
    $lock = openStore(false);
    $s = loadState();
    switch ($action) {
        case 'garden':
            out(snapshot($s));
        case 'updates':
            $after = (int) ($_GET['after'] ?? 0);
            $new = [];
            foreach ($s['plantings'] as $p) if ($p['id'] > $after) $new[] = $p;
            out(['version' => $s['version'], 'plantings' => $new]);
        case 'slots':
            $taken = takenSlots($s);
            $free = [];
            foreach (catalog()['slots'] as $sl) if (!isset($taken[$sl['id']])) $free[] = $sl;
            out($free);
        case 'check':
            // самопроверка для владельца сайта: ничего секретного не показывает
            $dir = dataDir();
            out([
                'ok' => true,
                'php' => PHP_VERSION,
                'mbstring' => extension_loaded('mbstring'),
                'dataFolder' => basename($dir) . (strpos($dir, __DIR__) === 0 ? ' (внутри public_html)' : ' (вне public_html — хорошо)'),
                'dataWritable' => is_writable($dir),
                'adminPasswordSet' => adminPassword() !== null,
                'configFound' => is_file(__DIR__ . '/config.php'),
                'configPasswordLine' => configMatch('ADMIN_PASSWORD') !== null,
                'configPreview' => configPreview(),
                'journal' => journalTail(15),
                'authorizationHeader' => isset($_SERVER['HTTP_AUTHORIZATION']) || isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']),
                'plantings' => count($s['plantings']),
            ]);
        case 'health':
            out(['ok' => true, 'plantings' => count($s['plantings']), 'server' => 'php']);
        default:
            out(fail('validation'), 404);
    }
}

if ($method !== 'POST') out(fail('validation'), 405);

$rawBody = (string) file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if (strlen($rawBody) > MAX_BODY) out(fail('validation'), 400);
$body = json_decode($rawBody === '' ? '{}' : $rawBody, true);
if (!is_array($body)) out(fail('validation'), 400);
$ip = clientIp();

// --- публичные действия ---
if ($action === 'login' || $action === 'plant' || $action === 'card') {
    $raw = mb_substr(is_scalar($body['code'] ?? null) ? (string) $body['code'] : '', 0, 100);

    if ($action === 'login' && !isValidCodeShape(normalizeCode($raw))) {
        // не похоже на 10-значный код — возможно, это пароль администратора
        if (isLimited("admin:$ip", ADMIN_LIMIT)) out(fail('rate_limited'));
        if (checkAdminPassword($raw)) out(['ok' => true, 'role' => 'admin', 'token' => issueAdminToken()]);
        registerFailure("admin:$ip", ADMIN_WINDOW);
        out(fail('invalid_code'));
    }

    if (isLimited("code:$ip", CODE_LIMIT)) out(fail('rate_limited'));
    $lock = openStore($action === 'plant');
    $s = loadState();
    if ($action === 'login') $res = engineLogin($s, $raw);
    elseif ($action === 'card') $res = engineCard($s, $raw);
    else {
        $res = enginePlant($s, [
            'code' => $raw,
            'teacherId' => $body['teacherId'] ?? 0,
            'flowerId' => $body['flowerId'] ?? 0,
            'color' => is_scalar($body['color'] ?? null) ? (string) $body['color'] : '',
            'slotId' => $body['slotId'] ?? 0,
        ]);
        if ($res['ok']) saveState($s);
    }
    flock($lock, LOCK_UN);
    if (!$res['ok'] && $res['error'] === 'invalid_code') registerFailure("code:$ip", CODE_WINDOW);
    out($res);
}

// --- действия администратора: только с действующим ключом сессии ---
if (!verifyAdminToken(adminTokenFromRequest())) out(fail('unauthorized'), 401);

$lock = openStore(true);
$s = loadState();
$changed = false;
switch ($action) {
    case 'admin-check':
        $res = ['ok' => true];
        break;
    case 'admin-stats':
        $res = adminStats($s);
        break;
    case 'admin-status':
        $st = $body['status'] ?? '';
        if (in_array($st, ['draft', 'open', 'closed'], true)) {
            $s['status'] = $st;
            bump($s);
            $res = ['ok' => true];
        } else $res = fail('validation');
        break;
    case 'admin-closing':
        $c = is_array($body['closing'] ?? null) ? $body['closing'] : [];
        $title = clean($c['title'] ?? '', 200);
        $text = clean($c['text'] ?? '', MAX_TEXT);
        if ($title === '' || $text === '') $res = fail('validation');
        else {
            $s['closing'] = ['title' => $title, 'text' => $text, 'showStats' => !empty($c['showStats'])];
            bump($s);
            $res = ['ok' => true];
        }
        break;
    case 'admin-teachers':
        $res = array_map(function ($t) {
            return [
                'id' => $t['id'],
                'firstName' => $t['firstName'],
                'middleName' => $t['middleName'],
                'lastName' => $t['lastName'],
                'subject' => $t['subject'],
                'color' => $t['color'],
                'flowerIds' => array_values($t['flowerIds']),
                'wish' => $t['wish'],
                'isDirector' => !empty($t['isDirector']),
            ];
        }, sortedTeachers($s));
        break;
    case 'admin-save-teacher':
        $res = saveTeacher($s, $body['teacher'] ?? null);
        break;
    case 'admin-delete-teacher':
        $res = deleteTeacher($s, (int) ($body['id'] ?? 0));
        break;
    case 'admin-clear-plantings':
        $res = clearPlantings($s);
        break;
    case 'admin-student-codes':
        $res = generateStudentCodes($s, $body['count'] ?? 0, $body['label'] ?? '');
        break;
    case 'admin-teacher-code':
        $res = generateTeacherCode($s, (int) ($body['teacherId'] ?? 0));
        break;
    case 'admin-export':
        $res = ['ok' => true, 'csv' => exportCodes($s)];
        break;
    default:
        out(fail('validation'), 404);
}
if (isset($res['ok']) && $res['ok'] === true && !in_array($action, ['admin-check', 'admin-export'], true)) saveState($s);
out($res);
