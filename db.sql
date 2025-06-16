create table UserData(
    UserDataId int auto_increment primary key,
    Username varchar(30) unique,
    Email varchar(50) unique,
    UserPassword char(60),
    UserRole enum('admin', 'mod', 'user') default 'user',
    SelectedLanguage char(2)
);
create table Movies(
    MovieId int auto_increment primary key,
    PlaybackId char(11) unique,
    ReleaseYear int,
    Duration int,
    Poster text
);
create table Languages(
    LanguageId int auto_increment primary key,
    LanguageCode char(2) unique,
    LanguageName varchar(30)
);
create table MovieTranslations(
    MovieTranslationId int auto_increment primary key,
    Title varchar(100),
    MovieDescription text,
    fk_MovieId int,
    fk_LanguageId int,
    foreign key (fk_MovieId) references Movies(MovieId) on delete cascade,
    foreign key (fk_LanguageId) references Languages(LanguageId) on delete cascade
);
create table Comments(
    CommentId int auto_increment primary key,
    Content text,
    fk_UserDataId int,
    fk_MovieId int,
    foreign key (fk_UserDataId) references UserData(UserDataId) on delete cascade,
    foreign key (fk_MovieId) references Movies(MovieId) on delete cascade
);
create table Ratings(
    RatingId int auto_increment primary key,
    RatingValue int,
    fk_UserDataId int,
    fk_MovieId int,
    foreign key (fk_UserDataId) references UserData(UserDataId) on delete cascade,
    foreign key (fk_MovieId) references Movies(MovieId) on delete cascade
);