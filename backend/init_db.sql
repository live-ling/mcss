create table if not exists email_templates
(
    id          varchar(36)                         not null
        primary key,
    name        varchar(100)                        not null,
    subject     varchar(255)                        not null,
    content     text                                not null,
    description text                                null,
    variables   json                                not null,
    created_at  timestamp default CURRENT_TIMESTAMP null,
    updated_at  timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP
);

create table if not exists site_settings
(
    id              int auto_increment
        primary key,
    contact_email   varchar(255)                        not null,
    qq_group        varchar(20)                         null,
    qq_group_link   varchar(255)                        null,
    updated_at      timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    icp_record      varchar(100)                        null,
    police_record   varchar(100)                        null,
    icp_record_link varchar(255)                        null
);

create table if not exists smtp_config
(
    id         varchar(36)                          not null
        primary key,
    host       varchar(255)                         not null,
    port       int                                  not null,
    username   varchar(255)                         not null,
    password   varchar(255)                         not null,
    from_email varchar(255)                         not null,
    from_name  varchar(255)                         not null,
    use_tls    tinyint(1) default 1                 null,
    is_active  tinyint(1) default 0                 null,
    created_at timestamp  default CURRENT_TIMESTAMP null,
    updated_at timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP
);

create table if not exists users
(
    id            varchar(36)                          not null
        primary key,
    username      varchar(50)                          not null,
    email         varchar(255)                         not null,
    password_hash varchar(255)                         not null,
    is_active     tinyint(1) default 1                 null,
    created_at    timestamp  default CURRENT_TIMESTAMP null,
    updated_at    timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint email
        unique (email),
    constraint username
        unique (username)
);

create table if not exists profiles
(
    id                 varchar(36)                                                 not null
        primary key,
    user_id            varchar(36)                                                 not null,
    username           varchar(50)                                                 not null,
    email              varchar(255)                                                null,
    role               enum ('player', 'owner', 'admin') default 'player'          null,
    avatar_url         varchar(255)                                                null,
    bio                text                                                        null,
    created_at         timestamp                         default CURRENT_TIMESTAMP null,
    updated_at         timestamp                         default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    minecraft_username varchar(50)                                                 null,
    constraint profiles_ibfk_1
        foreign key (user_id) references users (id)
            on delete cascade
);

create index user_id
    on profiles (user_id);

create table if not exists servers
(
    id                 varchar(36)                                                                                 not null
        primary key,
    owner_id           varchar(36)                                                                                 not null,
    name               varchar(100)                                                                                not null,
    description        text                                                                                        not null,
    ip_address         varchar(255)                                                                                not null,
    version            varchar(20)                                                                                 not null,
    server_type        enum ('survival', 'creative', 'rpg', 'minigame', 'skyblock', 'prison', 'factions', 'other') not null,
    is_pure_public     tinyint(1)                                          default 1                               null,
    requires_whitelist tinyint(1)                                          default 0                               null,
    requires_genuine   tinyint(1)                                          default 0                               null,
    max_players        int                                                                                         null,
    online_players     int                                                 default 0                               null,
    status             enum ('pending', 'approved', 'rejected', 'offline') default 'pending'                       null,
    featured           tinyint(1)                                          default 0                               null,
    view_count         int                                                 default 0                               null,
    group_number       varchar(20)                                                                                 null,
    group_link         varchar(255)                                                                                null,
    created_at         timestamp                                           default CURRENT_TIMESTAMP               null,
    updated_at         timestamp                                           default CURRENT_TIMESTAMP               null on update CURRENT_TIMESTAMP,
    constraint servers_ibfk_1
        foreign key (owner_id) references users (id)
            on delete cascade
);

create table if not exists server_comments
(
    id          varchar(36)                          not null
        primary key,
    server_id   varchar(36)                          not null,
    user_id     varchar(36)                          not null,
    content     text                                 not null,
    is_approved tinyint(1) default 0                 null,
    created_at  timestamp  default CURRENT_TIMESTAMP null,
    updated_at  timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint server_comments_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade,
    constraint server_comments_ibfk_2
        foreign key (user_id) references users (id)
            on delete cascade
);

create index server_id
    on server_comments (server_id);

create index user_id
    on server_comments (user_id);

create table if not exists server_edit_requests
(
    id         varchar(36)                                                        not null
        primary key,
    server_id  varchar(36)                                                        not null,
    owner_id   varchar(36)                                                        not null,
    changes    json                                                               not null,
    status     enum ('pending', 'approved', 'rejected') default 'pending'         null,
    admin_note text                                                               null,
    created_at timestamp                                default CURRENT_TIMESTAMP null,
    updated_at timestamp                                default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint server_edit_requests_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade,
    constraint server_edit_requests_ibfk_2
        foreign key (owner_id) references users (id)
            on delete cascade
);

create index owner_id
    on server_edit_requests (owner_id);

create index server_id
    on server_edit_requests (server_id);

create table if not exists server_favorites
(
    id         varchar(36)                         not null
        primary key,
    server_id  varchar(36)                         not null,
    user_id    varchar(36)                         not null,
    created_at timestamp default CURRENT_TIMESTAMP null,
    constraint server_id
        unique (server_id, user_id),
    constraint server_favorites_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade,
    constraint server_favorites_ibfk_2
        foreign key (user_id) references users (id)
            on delete cascade
);

create index user_id
    on server_favorites (user_id);

create table if not exists server_images
(
    id            varchar(36)                          not null
        primary key,
    server_id     varchar(36)                          not null,
    image_url     varchar(255)                         not null,
    is_primary    tinyint(1) default 0                 null,
    display_order int        default 0                 null,
    created_at    timestamp  default CURRENT_TIMESTAMP null,
    constraint server_images_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade
);

create index server_id
    on server_images (server_id);

create table if not exists server_likes
(
    id         varchar(36)                         not null
        primary key,
    server_id  varchar(36)                         not null,
    user_id    varchar(36)                         not null,
    created_at timestamp default CURRENT_TIMESTAMP null,
    constraint server_id
        unique (server_id, user_id),
    constraint server_likes_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade,
    constraint server_likes_ibfk_2
        foreign key (user_id) references users (id)
            on delete cascade
);

create index user_id
    on server_likes (user_id);

create table if not exists server_notification_configs
(
    id                   varchar(36)                                                  not null
        primary key,
    server_id            varchar(36)                                                  not null,
    notify_enabled       tinyint(1)                         default 0                 null,
    player_count_enabled tinyint(1)                         default 0                 null,
    check_interval       int                                default 30                null,
    notification_email   varchar(255)                                                 null,
    email_verified       tinyint(1)                         default 0                 null,
    server_priority      enum ('main', 'secondary', 'test') default 'secondary'       null,
    created_at           timestamp                          default CURRENT_TIMESTAMP null,
    updated_at           timestamp                          default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint server_notification_configs_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade
);

create index server_id
    on server_notification_configs (server_id);

create table if not exists server_notification_records
(
    id                varchar(36)                                       not null
        primary key,
    server_id         varchar(36)                                       not null,
    owner_id          varchar(36)                                       not null,
    notification_type enum ('offline', 'online')                        not null,
    message           text                                              not null,
    status            enum ('read', 'unread') default 'unread'          not null,
    created_at        timestamp               default CURRENT_TIMESTAMP not null,
    updated_at        timestamp               default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    constraint server_notification_records_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade,
    constraint server_notification_records_ibfk_2
        foreign key (owner_id) references users (id)
            on delete cascade
);

create index idx_created_at
    on server_notification_records (created_at);

create index idx_notification_type
    on server_notification_records (notification_type);

create index idx_owner_id
    on server_notification_records (owner_id);

create index idx_server_id
    on server_notification_records (server_id);

create index idx_status
    on server_notification_records (status);

create table if not exists server_offline_events
(
    id                       varchar(36)                         not null
        primary key,
    server_id                varchar(36)                         not null,
    offline_start_timestamp  bigint                              not null,
    online_timestamp         bigint                              null,
    offline_duration_seconds int                                 null,
    notification_sent_at     timestamp default CURRENT_TIMESTAMP null,
    created_at               timestamp default CURRENT_TIMESTAMP null,
    updated_at               timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint server_offline_events_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade
);

create index idx_offline_start
    on server_offline_events (offline_start_timestamp);

create index idx_server_id_offline
    on server_offline_events (server_id);

create table if not exists server_player_count_history
(
    id           varchar(36)                         not null
        primary key,
    server_id    varchar(36)                         not null,
    timestamp    timestamp default CURRENT_TIMESTAMP not null,
    player_count int       default 0                 not null,
    max_players  int                                 null,
    created_at   timestamp default CURRENT_TIMESTAMP not null,
    constraint server_player_count_history_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade
);

create table if not exists server_reports
(
    id          varchar(36)                                           not null
        primary key,
    server_id   varchar(36)                                           null,
    comment_id  varchar(36)                                           null,
    reporter_id varchar(36)                                           not null,
    reason      text                                                  not null,
    status      enum ('pending', 'handled') default 'pending'         null,
    handled_by  varchar(36)                                           null,
    handled_at  timestamp                                             null,
    created_at  timestamp                   default CURRENT_TIMESTAMP null,
    constraint server_reports_ibfk_1
        foreign key (server_id) references servers (id)
            on delete set null,
    constraint server_reports_ibfk_2
        foreign key (comment_id) references server_comments (id)
            on delete set null,
    constraint server_reports_ibfk_3
        foreign key (reporter_id) references users (id)
            on delete cascade,
    constraint server_reports_ibfk_4
        foreign key (handled_by) references users (id)
            on delete set null
);

create index comment_id
    on server_reports (comment_id);

create index handled_by
    on server_reports (handled_by);

create index reporter_id
    on server_reports (reporter_id);

create index server_id
    on server_reports (server_id);

create table if not exists server_tags
(
    id         varchar(36)                         not null
        primary key,
    server_id  varchar(36)                         not null,
    tag        varchar(50)                         not null,
    created_at timestamp default CURRENT_TIMESTAMP null,
    constraint server_id
        unique (server_id, tag),
    constraint server_tags_ibfk_1
        foreign key (server_id) references servers (id)
            on delete cascade
);

create index owner_id
    on servers (owner_id);

create table if not exists verification_codes
(
    id         varchar(36)                                                                                               not null
        primary key,
    user_id    varchar(36)                                                                                               null,
    email      varchar(255)                                                                                              not null,
    code       varchar(10)                                                                                               not null,
    type       enum ('email_change', 'email_verify', 'password_reset', 'owner_verification', 'register', 'email_update') not null,
    expires_at timestamp                                                                                                 not null,
    used       tinyint(1) default 0                                                                                      null,
    created_at timestamp  default CURRENT_TIMESTAMP                                                                      null,
    constraint verification_codes_ibfk_1
        foreign key (user_id) references users (id)
            on delete cascade
);

create index user_id
    on verification_codes (user_id);

