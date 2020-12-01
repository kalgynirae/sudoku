create table if not exists rooms
(
    /* id is stored as a blob because sqlite can do i128, but not u128, and sqlx
     * doesn't support either of them. */
    id    blob primary key not null,
    board blob             not null
);
