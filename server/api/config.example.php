<?php

return [
    'db' => [
        'host' => 'localhost',
        'name' => 'database_name',
        'user' => 'database_user',
        'password' => 'database_password',
    ],
    // Первый пользователь с этим адресом становится владельцем общей книги.
    'admin_email' => 'owner@example.com',
    'app_url' => 'https://example.com/vkus-doma',
    'uploads_dir' => __DIR__ . '/../uploads',
];
