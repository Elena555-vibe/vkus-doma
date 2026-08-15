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
    // Адрес отправителя должен существовать на подключённом домене Timeweb.
    'mail_from' => 'no-reply@example.com',
    'mail_from_name' => 'Вкус дома',
    'uploads_dir' => __DIR__ . '/../uploads',
];
