<?php
declare(strict_types=1);

// Разрешаем только опубликованные интерфейсы книги, а не произвольные сайты.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = ['https://ck663923.tw1.ru', 'https://elena555-vibe.github.io'];
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    echo json_encode(['error' => 'Сервер ещё настраивается.']);
    exit;
}
$config = require $configFile;

function reply(array $body, int $status = 200): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function uuid(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20));
}

function body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) reply(['error' => 'Некорректные данные.'], 400);
    return $decoded;
}

function token(): string { return bin2hex(random_bytes(32)); }

function currentUser(PDO $db): ?array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) return null;
    $hash = hash('sha256', $matches[1]);
    $query = $db->prepare('SELECT u.id, u.email, u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() LIMIT 1');
    $query->execute([$hash]);
    return $query->fetch() ?: null;
}

function requireUser(PDO $db): array {
    $user = currentUser($db);
    if (!$user) reply(['error' => 'Нужно войти в личную книгу.'], 401);
    return $user;
}

function issueSession(PDO $db, array $user): string {
    $plain = token();
    $query = $db->prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 180 DAY))');
    $query->execute([uuid(), $user['id'], hash('sha256', $plain)]);
    return $plain;
}

function jsonValue(mixed $value, string $fallback = '[]'): string {
    if (is_string($value)) return $value;
    return json_encode($value ?? json_decode($fallback, true), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function recipeFromRow(array $row): array {
    return [
        'id' => $row['id'],
        'source' => $row['source'],
        'title' => $row['title'],
        'category' => $row['category'],
        'author' => $row['author'],
        'servings' => (float)$row['servings'],
        'time' => $row['cooking_time'],
        'difficulty' => $row['difficulty'],
        'image' => $row['image_path'],
        'ingredients' => json_decode($row['ingredients'], true) ?: [],
        'steps' => json_decode($row['steps'], true) ?: [],
        'freezer' => $row['freezer'] ? json_decode($row['freezer'], true) : null,
        'ownerId' => $row['owner_id'],
    ];
}

function payloadToFields(array $data): array {
    $title = trim((string)($data['title'] ?? ''));
    $category = trim((string)($data['category'] ?? ''));
    $time = trim((string)($data['time'] ?? ''));
    $ingredients = $data['ingredients'] ?? [];
    $steps = $data['steps'] ?? [];
    if ($title === '' || $category === '' || $time === '' || !is_array($ingredients) || count($ingredients) === 0 || !is_array($steps) || count($steps) === 0) {
        reply(['error' => 'Заполните название, категорию, время, ингредиенты и шаги.'], 422);
    }
    if (mb_strlen($title) > 180 || mb_strlen($category) > 80 || mb_strlen($time) > 80) reply(['error' => 'Одно из полей слишком длинное.'], 422);
    $servings = (float)($data['servings'] ?? 0);
    if ($servings <= 0 || $servings > 10000) reply(['error' => 'Укажите корректное количество порций.'], 422);
    return [
        $title, $category, !empty($data['author']) ? trim((string)$data['author']) : null, $servings, $time,
        trim((string)($data['difficulty'] ?? 'Легко')) ?: 'Легко', $data['image'] ?? null,
        jsonValue($ingredients), jsonValue($steps), isset($data['freezer']) ? jsonValue($data['freezer'], 'null') : null,
    ];
}

function findRecipe(PDO $db, string $id): ?array {
    $query = $db->prepare('SELECT * FROM recipes WHERE id=? LIMIT 1');
    $query->execute([$id]);
    return $query->fetch() ?: null;
}

function canRead(array $recipe, ?array $user): bool {
    return (bool)$recipe['is_published'] || ($user && ($user['id'] === $recipe['owner_id'] || (bool)$user['is_admin']));
}

function canWrite(array $recipe, array $user): bool {
    return $user['id'] === $recipe['owner_id'] || ((bool)$user['is_admin'] && $recipe['source'] === 'shared');
}

try {
    $db = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db']['host'], $config['db']['name']),
        $config['db']['user'],
        $config['db']['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (Throwable) {
    reply(['error' => 'Не удалось подключиться к хранилищу.'], 503);
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'health') reply(['ok' => true]);

if ($action === 'auth.register' && $method === 'POST') {
    $input = body();
    $email = mb_strtolower(trim((string)($input['email'] ?? '')));
    $password = (string)($input['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($password) < 10) reply(['error' => 'Укажите email и пароль не короче 10 символов.'], 422);
    $check = $db->prepare('SELECT id FROM users WHERE email=?'); $check->execute([$email]);
    if ($check->fetch()) reply(['error' => 'Этот email уже зарегистрирован. Войдите в книгу.'], 409);
    $user = ['id' => uuid(), 'email' => $email, 'is_admin' => mb_strtolower($config['admin_email'] ?? '') === $email ? 1 : 0];
    $add = $db->prepare('INSERT INTO users (id,email,password_hash,is_admin) VALUES (?,?,?,?)');
    $add->execute([$user['id'], $email, password_hash($password, PASSWORD_DEFAULT), $user['is_admin']]);
    reply(['token' => issueSession($db, $user), 'user' => ['email' => $email, 'isAdmin' => (bool)$user['is_admin']]], 201);
}

if ($action === 'auth.login' && $method === 'POST') {
    $input = body(); $email = mb_strtolower(trim((string)($input['email'] ?? '')));
    $query = $db->prepare('SELECT id,email,password_hash,is_admin FROM users WHERE email=? LIMIT 1'); $query->execute([$email]); $user = $query->fetch();
    if (!$user || !password_verify((string)($input['password'] ?? ''), $user['password_hash'])) reply(['error' => 'Неверный email или пароль.'], 401);
    reply(['token' => issueSession($db, $user), 'user' => ['email' => $user['email'], 'isAdmin' => (bool)$user['is_admin']]]);
}

if ($action === 'auth.me') {
    $user = requireUser($db); reply(['user' => ['id' => $user['id'], 'email' => $user['email'], 'isAdmin' => (bool)$user['is_admin']]]);
}

if ($action === 'auth.logout' && $method === 'POST') {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) { $remove = $db->prepare('DELETE FROM sessions WHERE token_hash=?'); $remove->execute([hash('sha256', $matches[1])]); }
    reply(['ok' => true]);
}

if ($action === 'recipes.list') {
    $user = requireUser($db);
    $query = $db->prepare('SELECT * FROM recipes WHERE is_published=1 OR owner_id=? ORDER BY updated_at DESC'); $query->execute([$user['id']]);
    reply(['recipes' => array_map('recipeFromRow', $query->fetchAll())]);
}

if ($action === 'recipes.public') {
    $query = $db->query('SELECT * FROM recipes WHERE is_published=1 ORDER BY updated_at DESC');
    reply(['recipes' => array_map('recipeFromRow', $query->fetchAll())]);
}

if ($action === 'recipes.get') {
    $recipe = findRecipe($db, (string)($_GET['id'] ?? '')); $user = currentUser($db);
    if (!$recipe || !canRead($recipe, $user)) reply(['error' => 'Рецепт не найден.'], 404);
    reply(['recipe' => recipeFromRow($recipe)]);
}

if ($action === 'recipes.create' && $method === 'POST') {
    $user = requireUser($db); $input = body(); $fields = payloadToFields($input);
    $shared = ($input['source'] ?? 'personal') === 'shared' && (bool)$user['is_admin']; $id = uuid();
    $query = $db->prepare('INSERT INTO recipes (id,owner_id,source,is_published,title,category,author,servings,cooking_time,difficulty,image_path,ingredients,steps,freezer) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $query->execute([$id, $user['id'], $shared ? 'shared' : 'personal', $shared ? 1 : 0, ...$fields]);
    reply(['recipe' => recipeFromRow(findRecipe($db, $id))], 201);
}

if ($action === 'recipes.update' && $method === 'PUT') {
    $user = requireUser($db); $id = (string)($_GET['id'] ?? ''); $recipe = findRecipe($db, $id);
    if (!$recipe || !canWrite($recipe, $user)) reply(['error' => 'Нет доступа к изменению рецепта.'], 403);
    $input = body(); $fields = payloadToFields($input);
    $shared = ($input['source'] ?? $recipe['source']) === 'shared' && (bool)$user['is_admin'];
    $query = $db->prepare('UPDATE recipes SET source=?,is_published=?,title=?,category=?,author=?,servings=?,cooking_time=?,difficulty=?,image_path=?,ingredients=?,steps=?,freezer=? WHERE id=?'); $query->execute([$shared ? 'shared' : 'personal', $shared ? 1 : 0, ...$fields, $id]);
    reply(['recipe' => recipeFromRow(findRecipe($db, $id))]);
}

if ($action === 'recipes.delete' && $method === 'DELETE') {
    $user = requireUser($db); $id = (string)($_GET['id'] ?? ''); $recipe = findRecipe($db, $id);
    if (!$recipe || !canWrite($recipe, $user)) reply(['error' => 'Нет доступа к удалению рецепта.'], 403);
    $query = $db->prepare('DELETE FROM recipes WHERE id=?'); $query->execute([$id]); reply(['ok' => true]);
}

if ($action === 'favorites.list') {
    $user = requireUser($db); $query = $db->prepare('SELECT recipe_id FROM favorites WHERE user_id=?'); $query->execute([$user['id']]); reply(['favorites' => array_column($query->fetchAll(), 'recipe_id')]);
}

if ($action === 'favorites.toggle' && $method === 'POST') {
    $user = requireUser($db); $id = (string)(body()['recipeId'] ?? ''); $recipe = findRecipe($db, $id);
    if (!$recipe || !canRead($recipe, $user)) reply(['error' => 'Рецепт не найден.'], 404);
    $check = $db->prepare('SELECT 1 FROM favorites WHERE user_id=? AND recipe_id=?'); $check->execute([$user['id'], $id]);
    if ($check->fetch()) { $remove = $db->prepare('DELETE FROM favorites WHERE user_id=? AND recipe_id=?'); $remove->execute([$user['id'], $id]); $isFavorite = false; }
    else { $add = $db->prepare('INSERT INTO favorites (user_id,recipe_id) VALUES (?,?)'); $add->execute([$user['id'], $id]); $isFavorite = true; }
    reply(['isFavorite' => $isFavorite]);
}

if ($action === 'notes.save' && $method === 'POST') {
    $user = requireUser($db); $input = body(); $id = (string)($input['recipeId'] ?? ''); $recipe = findRecipe($db, $id);
    if (!$recipe || !canRead($recipe, $user)) reply(['error' => 'Рецепт не найден.'], 404);
    $note = trim((string)($input['note'] ?? ''));
    $query = $db->prepare('INSERT INTO recipe_notes (user_id,recipe_id,note) VALUES (?,?,?) ON DUPLICATE KEY UPDATE note=VALUES(note)'); $query->execute([$user['id'], $id, $note]); reply(['ok' => true]);
}

if ($action === 'notes.list') {
    $user = requireUser($db); $query = $db->prepare('SELECT recipe_id,note FROM recipe_notes WHERE user_id=?'); $query->execute([$user['id']]); reply(['notes' => $query->fetchAll(PDO::FETCH_KEY_PAIR)]);
}

if ($action === 'uploads.image' && $method === 'POST') {
    $user = requireUser($db); $file = $_FILES['image'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] > 1_500_000) reply(['error' => 'Загрузите изображение до 1,5 МБ.'], 422);
    $finfo = new finfo(FILEINFO_MIME_TYPE); $mime = $finfo->file($file['tmp_name']); $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($extensions[$mime])) reply(['error' => 'Поддерживаются JPG, PNG и WebP.'], 422);
    $folder = rtrim($config['uploads_dir'], '/') . '/' . $user['id']; if (!is_dir($folder) && !mkdir($folder, 0755, true)) reply(['error' => 'Не удалось сохранить фото.'], 500);
    $name = bin2hex(random_bytes(16)) . '.' . $extensions[$mime]; if (!move_uploaded_file($file['tmp_name'], $folder . '/' . $name)) reply(['error' => 'Не удалось сохранить фото.'], 500);
    reply(['path' => 'uploads/' . $user['id'] . '/' . $name], 201);
}

if ($action === 'backup.export') {
    $user = requireUser($db); $recipes = $db->prepare('SELECT * FROM recipes WHERE owner_id=?'); $recipes->execute([$user['id']]);
    $favorites = $db->prepare('SELECT recipe_id FROM favorites WHERE user_id=?'); $favorites->execute([$user['id']]);
    $notes = $db->prepare('SELECT recipe_id,note FROM recipe_notes WHERE user_id=?'); $notes->execute([$user['id']]);
    reply(['version' => 1, 'exportedAt' => gmdate(DATE_ATOM), 'recipes' => array_map('recipeFromRow', $recipes->fetchAll()), 'favorites' => array_column($favorites->fetchAll(), 'recipe_id'), 'notes' => $notes->fetchAll(PDO::FETCH_KEY_PAIR)]);
}

reply(['error' => 'Неизвестный запрос.'], 404);
