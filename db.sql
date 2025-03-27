create table UserData(
    UserDataId int auto_increment primary key,
    Username varchar(30) unique,
    Email varchar(50) unique,
    UserPassword varchar(255),
    UserRole varchar()
);
create table Comments(
    CommentId int auto_increment primary key,
    Content text,
    fk_UserDataId int,
    fk_MovieId int,
    foreign key fk_UserDataId references UserData(UserDataId),
    foreign key fk_MovieId references Movies(MovieId)
);
create table Movies(
    MovieId int auto_increment primary key,
    Title varchar(50),
    MovieDescription text,
    PlaybackId varchar(11),
    Poster text
);
create table sessions(
    SessionId int auto_increment primary key
);
create table Ratings(
    RatingId int auto_increment primary key,
    RatingValue decimal(2,1),
    fk_UserDataId int,
    fk_MovieId int,
    foreign key fk_UserDataId references UserData(UserDataId),
    foreign key fk_MovieId references Movies(MovieId)
);