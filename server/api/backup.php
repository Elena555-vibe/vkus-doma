<?php
declare(strict_types=1);

// Запускается только из Cron/SSH. Через веб этот файл недоступен.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    fwrite(STDERR, "Vkus doma backup: config.php not found\n");
    exit(1);
}

$config = require $configFile;
$backupDir = (string)($config['backup_dir'] ?? dirname(__DIR__, 3) . '/backups/vkus-doma');
$retentionDays = max(7, min(90, (int)($config['backup_retention_days'] ?? 31)));

if (!is_dir($backupDir) && !mkdir($backupDir, 0700, true) && !is_dir($backupDir)) {
    fwrite(STDERR, "Vkus doma backup: cannot create backup directory\n");
    exit(1);
}

try {
    $db = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db']['host'], $config['db']['name']),
        $config['db']['user'],
        $config['db']['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );

    $stamp = gmdate('Y-m-d_H-i-s');
    $temporary = $backupDir . '/.vkus-doma_' . $stamp . '.sql.gz.tmp';
    $target = $backupDir . '/vkus-doma_' . $stamp . '.sql.gz';
    $output = gzopen($temporary, 'wb9');
    if ($output === false) throw new RuntimeException('cannot open dump file');

    $write = static function (string $line) use ($output): void {
        if (gzwrite($output, $line) === false) throw new RuntimeException('cannot write dump');
    };
    $quoteName = static fn(string $name): string => '`' . str_replace('`', '``', $name) . '`';

    $write("-- Вкус дома: резервная копия базы\n");
    $write('-- UTC: ' . gmdate(DATE_ATOM) . "\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");
    $tables = $db->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_NUM);

    foreach ($tables as $tableRow) {
        $table = (string)$tableRow[0];
        $create = $db->query('SHOW CREATE TABLE ' . $quoteName($table))->fetch(PDO::FETCH_NUM);
        $write('DROP TABLE IF EXISTS ' . $quoteName($table) . ";\n");
        $write((string)$create[1] . ";\n\n");

        $rows = $db->query('SELECT * FROM ' . $quoteName($table));
        while ($row = $rows->fetch()) {
            $columns = array_keys($row);
            $values = array_map(static fn(mixed $value): string => $value === null ? 'NULL' : $db->quote((string)$value), array_values($row));
            $write('INSERT INTO ' . $quoteName($table) . ' (' . implode(',', array_map($quoteName, $columns)) . ') VALUES (' . implode(',', $values) . ");\n");
        }
        $write("\n");
    }

    $write("SET FOREIGN_KEY_CHECKS=1;\n");
    gzclose($output);
    chmod($temporary, 0600);
    if (!rename($temporary, $target)) throw new RuntimeException('cannot finalize dump');

    $cutoff = time() - ($retentionDays * 86400);
    foreach (glob($backupDir . '/vkus-doma_*.sql.gz') ?: [] as $file) {
        if (filemtime($file) !== false && filemtime($file) < $cutoff) unlink($file);
    }
    fwrite(STDOUT, 'Vkus doma backup created: ' . basename($target) . PHP_EOL);
} catch (Throwable $error) {
    if (isset($temporary) && is_file($temporary)) unlink($temporary);
    fwrite(STDERR, 'Vkus doma backup failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
