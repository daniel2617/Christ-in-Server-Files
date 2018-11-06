const nodemailer = require('nodemailer');
var http = require('http').Server();
var client = require('socket.io').listen(8080).sockets;
var User = require('./models/users');
var Post = require('./models/post');
var Comment = require('./models/comments');
var Status = require('./models/status');
var Like = require('./models/like');
var Group = require('./models/groups');
var Request = require('./models/prayerRequest');
var Message = require('./models/messages');
var Report = require('./models/reports');
var http = require('http').Server();
var users = [];
var multer = require('multer');
var fs = require('fs');
var storage =   multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './public/uploads');
    },
    filename: function (req, file, callback) {
        var extArray = file.mimetype.split("/");
        var extension = extArray[1];
        callback(null, file.fieldname + '_'+Date.now()+'.'+extension);
    }

});
var upload = multer({ storage : storage}).single('churchfile');
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'christinmobileapp@gmail.com',
        pass: 'christ-inapp'
    }
});
var interval = setInterval(function () {
    Status.find({}, function (err, statuses) {
        if(err)
            throw err;
        else if(statuses.length > 0){
            var times = [];
            statuses.forEach(function(person){
                person.images.map(function(image){
                    times.push({time: image.time, url: image.url});
                });
            });
            var dateNow = parseInt(Date.now());
            times.forEach(function (value) {

                if(dateNow - value.time > 86400000){
                    Status.updateOne({'images.time': value.time}, {$pull: {
                            images:{
                                'time': value.time
                            }
                        }},function (err) {
                        if(err)
                            throw err;
                        else
                            fs.unlink('public/'+ value.url);

                    });
                }
            });

        }
    })
}, 300000);
module.exports = function (app) {
    client.on('connection',function(socket)
    {

        socket.on('updatemessageImage',function (data) {
            var datam = data.data;
            Message.update({'unique': datam[1]}, {$set: {
                    'fileUrl': datam[0]
                }}, function (err) {
                if(err)
                    throw err;
                else{
                    socket.emit('updatemessageImage', {data: datam});
                    socket.broadcast.emit('updatemessageImage', {data: datam});
                }
            });
        });
        //blocking user
        socket.on('updateBlock', function (data) {
            if(data.action == 'Block') {
                data.action = 'Unblock';
                User.update({'user_id': data.from, chats: {$elemMatch: {dateMic: data.to}}},
                    {$set: {'chats.$.block': 'Unblock'}}, function (err) {
                        if (err)
                            throw err;
                    });
                User.update({'user_id': data.to, chats: {$elemMatch: {dateMic: data.from}}},
                    {$set: {'chats.$.block': 'Blocked'}}, function (err) {
                        if (err)
                            throw err;
                    });
                socket.emit('updateBlock', data);
                data.action = 'Blocked';
                socket.broadcast.emit('updateBlock', data);
            }else if(data.action == 'Unblock'){
                User.update({'user_id': data.from, chats: {$elemMatch: {dateMic: data.to}}},
                    {$set: {'chats.$.block': 'Block'}}, function (err) {
                        if (err)
                            throw err;
                    });
                User.update({'user_id': data.to, chats: {$elemMatch: {dateMic: data.from}}},
                    {$set: {'chats.$.block': 'Block'}}, function (err) {
                        if (err)
                            throw err;
                    });
                data.action = 'Block';
                socket.emit('updateBlock', data);
                socket.broadcast.emit('updateBlock', data);
            }

        });
        //deleting mess
        socket.on('deleteMess', function (data) {
            if(!data.if){
                if(data.type == 'some'){
                    Message.find({$or:[
                            {'fromId':data.myId, 'toId':data.friendId, 'dateString':{$in: data.messages} },
                            {'fromId': data.friendId, 'toId':data.myId, 'dateString': {$in: data.messages}}]},function (err, result) {
                        if(err)
                            throw err;
                        else{
                            result.map(function (q) {
                                if (q.deleteFrom.length == 0) {
                                    Message.update({
                                        $or: [
                                            {'fromId':data.myId, 'toId':data.friendId, 'dateString': q.dateString },
                                            {'fromId': data.friendId, 'toId':data.myId, 'dateString': q.dateString}
                                        ]
                                    }, {$push: {'deleteFrom': data.myId}}, function (err) {
                                        if (err)
                                            throw err;
                                    });
                                } else if (q.deleteFrom && q.deleteFrom[0] !== data.myId) {
                                    Message.remove({
                                            $or: [
                                                {'fromId':data.myId, 'toId':data.friendId, 'deleteFrom.0': data.friendId, 'dateString': q.dateString},
                                                {'fromId': data.friendId, 'toId':data.myId, 'deleteFrom.0': data.friendId, 'dateString': q.dateString}
                                            ]
                                        },
                                        function (err) {
                                            if (err)
                                                throw err;
                                        });
                                }
                            });
                        }
                    });
                }else{
                    if(data.friendId) {
                        Message.update({
                            $or: [
                                {'fromId':data.myId, 'toId':data.friendId, 'deleteFrom.0': {$ne: data.friendId}},
                                {'fromId': data.friendId, 'toId':data.myId, 'deleteFrom.0': {$ne: data.friendId}}
                            ]
                        }, {$push: {'deleteFrom': data.myId}},{multi: true}, function (err) {
                            if (err)
                                throw err;
                        });
                        Message.remove({
                                $or: [
                                    {'fromId':data.myId, 'toId':data.friendId, 'deleteFrom.0': data.friendId},
                                    {'fromId': data.friendId, 'toId':data.myId, 'deleteFrom.0': data.friendId}
                                ]
                            },
                            function (err) {
                                if (err)
                                    throw err;
                            });
                    }
                }

            }else{
                //deleting message for group
            }
            socket.emit('deleteMess', data);
        });
        socket.on('upDateRead', function (data) {
            var datam = data.data;
            User.update({'user_id': datam[0], chats: { $elemMatch: { dateMic: datam[1]}}},
                {$set: {'chats.$.unreadTexts': 0}}, function (err) {
                    if(err)
                        throw err;
                });
        });
        socket.on('updateChatting', function(data){
            var datam = data.data;
            User.update({'user_id': datam[0],  chats: { $elemMatch: { dateMic: datam[1].dateMic}}},
                {$set: {'chats.$': datam[1]}}, function (err) {
                    if(err)
                        throw err;
                });

        });

        socket.on('updateRead',function(data){
            var datam = data.data;
            var indy = users.findIndex(m => m.id == datam.reader);
            if(indy == -1) {
                socket.prop = datam.reader;
                users.push({id: socket.prop, time: ['Online']});
            }else{
                users.splice(1,1);
                socket.prop = datam.reader;
                users.push({id: socket.prop, time: ['Online']});
            }
            socket.broadcast.emit('updateRead', datam);
            User.update({'user_id': datam.sender,  chats: { $elemMatch: { dateMic: datam.reader}}},
                {$set: {'chats.$.read': datam.type}}, function (err) {
                    if(err)
                        throw err;
                });
            Message.update({
                'fromId': datam.sender,
                'toId': datam.reader,
                $or:[{'read': 'sent'}, {'read': 'delivered'}]
            },{$set: {'read': datam.type}},{multi: true},function (err) {
                if(err)
                    throw err;
            });

        });
        //new note
        socket.on('newNote', function (data) {
            var now = Date.now();
            User.update({'user_id': data.owner},{$push:{notes: {
                        'text': data.text,
                        'dateCreated': data.date,
                        'id': now
                    }}}, function (err) {
                if(err)
                    throw err;
                else{
                    socket.emit('addNotes',{text: data.text, dateCreated: data.date, id:now});
                }
            })
        });
        //reporting a post
        socket.on('reportPost', function(data){
            var newReport = new Report();
            newReport.myId = data.myId;
            newReport.friendId = data.friendId;
            newReport.postId = data.postId;
            newReport.report = data.report;
            newReport.date = data.date;
            newReport.save(function (err) {
                if(err)
                    throw err;
            })
        });
        //fetchSubsequent
        socket.on('getSubsequent', function (data) {
            fetchData(data, data.postId, socket, data.dec);
        });
        //fetching user information
        socket.on('getUserInfo', function(data){
            var indy = users.findIndex(m => m.id == data.userId);
            if(indy == -1) {
                socket.prop = data.userId;
                users.push({id: socket.prop, time: ['Online']});
            }else{
                users.splice(1,1);
                socket.prop = data.userId;
                users.push({id: socket.prop, time: ['Online']});
            }

            if(indy !== -1){
                users[indy].time = ["Online"];
                socket.broadcast.emit('updatIngState', {data: data.userId, status: "Online"});
            }
                fetchData(data, 0, socket, null);
        });
        //updating a note
        socket.on('updateNote',function (data) {
            User.update({'user_id': data.owner, notes: {$elemMatch:{id: data.noteId}}},
                {$set: {'notes.$.text': data.noteText}},  function (err) {
                    if (err)
                        console.log(err);
                    else
                        socket.emit('updateNote1',data);
                });
        });
        //deleting a note
        socket.on('actionNote', function (data) {

            User.update({'user_id': data.owner},
                {$pull: {notes: {'id': data.noteId}}}, function (err) {
                    if(err)
                        throw err;
                    else
                        socket.emit('removeNote',{noteId: data.noteId});
                });
        });
        //updatingProfileInfo
        socket.on('updateProfile', function(data){

            var data = data.data;
            User.update({'user_id': data[0]}, {$set: {'phone': data[2], 'location': data[1], 'church': data[4], 'dob': data[3]}},
                function(err){
                    if(err)
                        throw err;
                    else
                        socket.emit('profileUpdate', {data: data});
                })
        });
        //fetchPersonalPosts
        socket.on('fetchPersonalPosts', function (data) {
            var response;
            Post.find({'postOwner': data.userId},function (err, results) {
                if(err)
                    throw err;
                else if(results.length > 0){
                    response = results;
                }else{
                    response = 'No data';
                }
                if(data.friends == true){
                    User.findOne({'user_id': data.myId,  friends: {$elemMatch:{friendId: data.userId}}},{searches: 0}, function(err, friends){
                        if(err)
                            throw err;
                        else{

                            if(friends){

                                socket.emit('postsFound', {response: response, friends: true});
                            }else{
                                socket.emit('postsFound', {response: response});
                            }
                        }
                    });

                }else{
                    socket.emit('postsFound', {response: response});
                }
                if(data.meUser == false) {
                    data.userId = data.myId;
                }
                if(results.length > 0) {
                    response.forEach(function (resx) {
                        Like.findOne({'likeId': data.userId, 'postId': resx.postId}, function (err, reslt) {
                            if (err)
                                throw(err);
                            else if (reslt) {
                                socket.emit('likedPost', {postId: resx.postId});
                            }
                        });

                    });
                }

            });
        });
        //makenewpost
        socket.on('makePost', function (data) {
            var postNo;
            Post.findOne({'postOwner': data.postOwner}, function(err, post){
                if(err)
                    throw err;
                else if(post){
                    postNo =  post.postNumber
                }else{
                    postNo = 0;
                }
                var gettime =  getTime();
                var newPost = new Post();
                newPost.postId = gettime[2];
                newPost.postOwner =  data.postOwner;
                newPost.postOwnerImage =  data.postOwnerImage;
                newPost.postOwnerNames =  data.postOwnerNames;
                newPost.postDate =  gettime[0];
                newPost.postText =  data.postText;
                newPost.postImage =  data.postImage;
                newPost.postLikes =  0;
                newPost.postComments = 0;
                newPost.postTime =  gettime[1];
                newPost.gradient = data.gradient;
                newPost.postNumber =  parseInt(postNo) + 1;
                newPost.save(function (err) {
                    if(err)
                        throw err;
                    else
                        socket.emit('postAdded',{added: true, post: newPost});
                })
            });

        });
        //adding like
        socket.on('addLike',function(data){
            var newLike = new Like();
            newLike.postId = data.postId;
            newLike.likeId = data.likeId;
            newLike.postOwnerImage = data.postOwnerImage;
            newLike.postOwnerNames = data.postOwnerNames;
            newLike.save(function (err) {
                if(err)
                    throw err;
                else {
                    Post.update({'postId': data.postId}, {$inc: {'postLikes': 1}}, function(err){
                        if(err)
                            throw err;
                        else{
                            socket.emit('likeUpdate', {data: data});
                            socket.broadcast.emit('likeUpdate', {data: data});
                        }
                    });

                }
            })
        });
        //remove a like;
        socket.on('removeLike', function(data){
            Like.remove({'postId': data.postId, 'likeId': data.likeId},function (err) {
                if(err)
                    throw err;
                else
                {
                    Post.update({'postId': data.postId}, {$inc: {'postLikes': -1}}, function(err){
                        if(err)
                            throw err;
                        else{
                            socket.emit('likeUpdate', {data: data});
                            socket.broadcast.emit('likeUpdate', {data: data});
                        }
                    });
                }
            });

        });
        //fetch like
        socket.on('fetchLikes', function(data){
            Like.find({'postId': data.postId}, function(err, results){
                if( err)
                    throw err;
                else
                    socket.emit('likesFound', {data: results});
            });
        });
        //ading a comment
        socket.on('makeComment',function (data) {
            var newComment = new Comment();
            newComment.postId = data.postId;
            newComment.commentId = data.commentId;
            newComment.commentdate = data.commentdate;
            newComment.commentTime = data.commentTime;
            newComment.commetimeId = data.commetimeId;
            newComment.commentText = data.commentText;
            newComment.commentOwnerImage = data.commentOwnerImage;
            newComment.commentNames = data.commentNames;
            newComment.save(function (err) {
                if(err)
                    throw err;
                else{
                    Post.update({'postId': data.postId}, {$inc: {'postComments': 1}}, function(err){
                        if(err)
                            throw err;
                        else{
                            socket.emit('commentsUpdate', {data: [data], data2: true});
                            socket.broadcast.emit('commentsUpdate', {data: [data], data2: true} );
                        }
                    });
                }
            });
        });
        //fecthingComments
        socket.on('fetchingComment',function (data) {

            Comment.find({'postId': data.postId},function (err, results) {
                if(err)
                    throw err;
                else {
                    socket.emit('commentsUpdate', {data: results});

                }
            })
        });
        //saving parayer request
        socket.on('prayerRequest', function (data) {
            var data = data.data;
            var newRequest = new Request();
            newRequest.Name = data[0];
            newRequest.Gender = data[1]
            newRequest.Email = data[2];
            newRequest.address = data[3];
            newRequest.request = data[4];
            newRequest.save(function (err) {
                if(err)
                    throw err;
                else
                    socket.emit('requestreceived', {data: true});
            })

        });
        // saving message
        socket.on('addMessage',function (data) {
            if(data.module == 'newMess') {
                if(data.group == false || data.group == undefined){
                    User.aggregate([
                        {"$match": {'user_id': data.friendData[0], 'chats.dateMic': data.myData.id}},
                        {$unwind: "$chats"},
                        {"$match": {'user_id': data.friendData[0], 'chats.dateMic': data.myData.id}},
                        {
                            "$group": {
                                "_id": "$_id._id",
                                "chats": {
                                    "$push": "$chats"
                                }
                            }
                        }
                    ]).exec(function (err, results) {
                        if (err)
                            throw err;
                        var unreadTexts;
                        var index;
                        if (results[0]) {
                            unreadTexts = parseInt(parseInt(results[0].chats[0].unreadTexts) + 1);
                            index = parseInt(parseInt(results[0].chats[0].lastMessNumber) + 1);
                        } else {
                            unreadTexts = 1;
                            index = 1;
                        }

                        var gettime = getTime();
                        var newMessage = new Message();
                        newMessage.fromname = data.myData.fullname;
                        newMessage.toname = data.friendData[1];
                        newMessage.fromImage = data.myData.image;
                        newMessage.toImage = data.friendData[2];
                        newMessage.fromId = data.myData.id;
                        newMessage.toId = data.friendData[0];
                        newMessage.date = gettime[0];
                        newMessage.time = gettime[1];
                        newMessage.message = data.message;
                        newMessage.dateString = gettime[2];
                        newMessage.read = 'sent';
                        newMessage.index = index;
                        if(data.unique){
                            newMessage.module = data.modulex;
                            newMessage.unique = data.unique;
                            newMessage.file = data.file;

                        }
                        socket.emit('addNewText', {data: [newMessage]});
                        socket.broadcast.emit('addNewText', {data: [newMessage]});
                        newMessage.save(function (err) {
                            if (err) throw err;
                            else {
                                User.update({'user_id': newMessage.fromId},
                                    {$pull: {chats: {'dateMic': newMessage.toId}}},
                                    function (err) {
                                        if (err)
                                            throw err;
                                        else {
                                            var chat = {
                                                image: newMessage.toImage,
                                                name: newMessage.toname,
                                                message: newMessage.message,
                                                time: newMessage.time,
                                                date: newMessage.date,
                                                dateMic: newMessage.toId,
                                                unreadTexts: 0,
                                                block: 'Block',
                                                read: 'sent',
                                                lastMessNumber: index,
                                                file: newMessage.file,
                                                toId: newMessage.toId,
                                                fromId: newMessage.fromId
                                            };
                                            User.update({'user_id': newMessage.fromId},
                                                {
                                                    $push: {
                                                        chats: chat
                                                    }
                                                }, function (err) {
                                                    if (err)
                                                        console.log(err);
                                                    else
                                                        socket.emit('newChat', chat);
                                                    socket.broadcast.emit('newChat', chat);

                                                });
                                        }
                                    });
                                User.update({'user_id': newMessage.toId},
                                    {$pull: {chats: {'dateMic': newMessage.fromId}}}, function (err) {
                                        if (err)
                                            throw err;
                                        else {
                                            var chat = {
                                                image: newMessage.fromImage,
                                                name: newMessage.fromname,
                                                message: newMessage.message,
                                                time: newMessage.time,
                                                date: newMessage.date,
                                                dateMic: newMessage.fromId,
                                                unreadTexts: unreadTexts,
                                                block: 'Block',
                                                file: newMessage.file,
                                                lastMessNumber: index,
                                                read: 'sent',
                                                toId: newMessage.toId,
                                                fromId: newMessage.fromId
                                            };
                                            User.update({'user_id': newMessage.toId},
                                                {
                                                    $push: {
                                                        chats: chat
                                                    }
                                                }, function (err) {
                                                    if (err)
                                                        console.log(err);
                                                    else
                                                        socket.emit('newChat', chat);
                                                    socket.broadcast.emit('newChat', chat);

                                                });
                                        }
                                    });

                            }
                        });
                    });
                }
                else if(data.group == true){
                    Group.findOne({'group_id': data.friendData[0]}, function (err, results) {
                        if (err)
                            throw err;
                        else {
                            results.groupMembers.forEach(function (member, indexy) {
                                User.aggregate([
                                    {
                                        "$match": {
                                            'user_id': member.memberId,
                                            'chats.dateMic': data.friendData[0]
                                        }
                                    },
                                    {$unwind: "$chats"},
                                    {
                                        "$match": {
                                            'user_id': member.memberId,
                                            'chats.dateMic': data.friendData[0]
                                        }
                                    },
                                    {
                                        "$group": {
                                            "_id": "$_id._id",
                                            "chats": {
                                                "$push": "$chats"
                                            }
                                        }
                                    }
                                ]).exec(function (err, results) {
                                    if (err)
                                        throw err;
                                    var unreadTexts;
                                    var index;
                                    if (results[0]) {
                                        unreadTexts = parseInt(parseInt(results[0].chats[0].unreadTexts) + 1);
                                        index = parseInt(parseInt(results[0].chats[0].lastMessNumber) + 1);
                                    } else {
                                        unreadTexts = 1;
                                        index = 1;
                                    }
                                    var newMessage = new Message();
                                    var gettime = getTime();
                                    newMessage.fromname = data.myData.fullname;
                                    newMessage.toname = data.friendData[1];
                                    newMessage.fromImage = data.myData.image;
                                    newMessage.toImage = data.friendData[2];
                                    newMessage.fromId = data.myData.id;
                                    newMessage.toId = data.friendData[0];
                                    newMessage.date = gettime[0];
                                    newMessage.time = gettime[1];
                                    newMessage.senderId = data.myData.id;
                                    newMessage.read = 'sent';
                                    newMessage.senderName = data.myData.fullname;
                                    newMessage.senderImage = data.myData.image;
                                    if(data.unique){
                                        newMessage.module = data.modulex;
                                        newMessage.unique = data.unique;
                                        newMessage.file = data.file;

                                    }
                                    newMessage.message = data.message;
                                    newMessage.dateString = gettime[2];
                                    newMessage.index = index;

                                    if (indexy == 0) {
                                        socket.emit('addNewText', {data: [newMessage]});
                                        socket.broadcast.emit('addNewText', {data: [newMessage]});
                                        newMessage.save(function (err) {
                                            if (err) throw err;
                                        })
                                    }
                                    User.update({'user_id': member.memberId},
                                        {$pull: {chats: {'dateMic': newMessage.toId}}}, function (err) {
                                            if (err)
                                                throw err;
                                            else {
                                                var chat = {
                                                    image: newMessage.toImage,
                                                    name: newMessage.toname,
                                                    message: newMessage.message,
                                                    time: newMessage.time,
                                                    date: newMessage.date,
                                                    dateMic: newMessage.toId,
                                                    unreadTexts: unreadTexts,
                                                    block: 'Block',
                                                    file: newMessage.file,
                                                    read: 'sent',
                                                    lastMessNumber: index,
                                                    group: true,
                                                    fromId: newMessage.fromId
                                                };
                                                if(member.memberId == data.myData.id){
                                                    var chaty = chat;
                                                    chaty.unreadTexts = 0;
                                                    console.log(chaty);
                                                    User.update({'user_id': member.memberId},
                                                        {
                                                            $push: {
                                                                chats: chaty
                                                            }
                                                        }, function (err) {
                                                            if (err)
                                                                console.log(err);
                                                            else
                                                                socket.emit('newChat', chaty);

                                                        });
                                                }else{
                                                    User.update({'user_id': member.memberId},
                                                        {
                                                            $push: {
                                                                chats: chat
                                                            }
                                                        }, function (err) {
                                                            if (err)
                                                                console.log(err);
                                                            else
                                                                socket.broadcast.emit('newChat', chat);

                                                        });
                                                }

                                            }
                                        });

                                });

                            })
                        }
                    })
                }
            }else if(data.module == 'firstFetch'){
                var indy = users.findIndex(m => m.id == data.friendData[0]);
                var indy1 = users.findIndex(m => m.id == data.myData.id);
                var friendStatus;
                if(indy !== -1) {
                    friendStatus = users[indy].time;
                }
                if(indy1 !== -1){
                    users[indy1].time = ["Online"];
                    socket.broadcast.emit('updatIngState', {data: data.myData.id, status: "Online"});
                }
                data.friendData[0] = parseInt(data.friendData[0]);
                User.aggregate([
                    { "$match": {'user_id':data.myData.id,'chats.dateMic':data.friendData[0]} },
                    {$unwind: "$chats"},
                    { "$match":{'user_id': data.myData.id,'chats.dateMic':data.friendData[0]} },
                    { "$group": {
                            "_id": "$_id._id",
                            "chats": {
                                "$push":  "$chats"
                            }
                        }}
                ]).exec(function (err, results) {
                    if (err)
                        throw err;

                    if (results[0]) {
                        var  lastMessNumber = results[0].chats[0].lastMessNumber;
                        if(data.group ==false || data.group == undefined) {
                            Message.find({
                                $or: [{
                                    'fromId': data.myData.id,
                                    'toId': data.friendData[0],
                                    index: {$lte: lastMessNumber},
                                    'deleteFrom':{$ne: data.myData.id}
                                },
                                    {
                                        'toId': data.myData.id,
                                        'fromId': data.friendData[0],
                                        index: {$lte: lastMessNumber},
                                        'deleteFrom':{$ne: data.myData.id}
                                    }]
                            }, function (err, messages) {
                                if (err)
                                    throw err;
                                socket.emit('addNewText', {
                                    data: messages,
                                    friendStatus: friendStatus,
                                    message2: true
                                });
                            }).sort({$natural: -1}).limit(30);
                        }else{
                            Message.find(
                                {
                                    'toId': data.friendData[0],
                                    index: {$lte: lastMessNumber},
                                    'deleteFrom':{$ne: data.myData.id}
                                }, function (err, messages) {
                                    if (err)
                                        throw err;
                                    socket.emit('addNewText', {
                                        data: messages,
                                        friendStatus: friendStatus,
                                        message2: true
                                    });
                                }).sort({$natural: -1}).limit(30);
                        }
                    }
                });

            }else{
                if(data.group ==true){
                    Message.find(
                        {'toId': data.friendData[0], index: {$lt: data.lastMessNumber}}, function (err, messages) {
                            if (err)
                                throw err;

                            socket.emit('addNewText', {
                                data: messages,
                                message2: true
                            });
                        }).sort({$natural: -1}).limit(30);
                }else {
                    Message.find({
                        $or: [{'fromId': data.myData.id, 'toId': data.friendData[0], index: {$lt: data.lastMessNumber}},
                            {'toId': data.myData.id, 'fromId': data.friendData[0], index: {$lt: data.lastMessNumber}}]
                    }, function (err, messages) {
                        if (err)
                            throw err;

                        socket.emit('addNewText', {
                            data: messages,
                            message2: true
                        });
                    }).sort({$natural: -1}).limit(30);
                }

            }
        });
        //addFriend
        socket.on('Add friend', function(data){
            var me = data.myData;
            var friend = data.friendData;
            var getdate = getTime();
            friendfrom = [{
                name: me.fullname,
                friendId: me.id,
                image: me.image,
                status: 'Accept',
                date: getdate[0],
                time: getdate[1]
            }];
            friendTo = [{
                name: friend[1],
                friendId: friend[0],
                image: friend[2],
                status: 'Remove request',
                date: getdate[0],
                time: getdate[1],

            }];
            socket.emit('addFriendList', {friend: friendTo[0], to: friendTo[0].friendId, from: friendfrom[0].friendId});
            socket.broadcast.emit('addFriendList', {friend: friendfrom[0], to: friendTo[0].friendId, from:friendfrom[0].friendId});
            User.update({'user_id': me.id},{$push: {friends: friendTo[0]}},function (err) {
                if(err)
                    throw err;
                else{

                }
            });

            User.update({'user_id': friend[0]},{$push: {friends: friendfrom[0]}},function (err) {
                if(err)
                    throw err;
                else{

                }
            });

        });
        //hide a post
        socket.on('hideApost', function(data){
            Post.updateOne({'postId': data[0]}, {$push:{
                    notSee:{
                        id: data[1]
                    }
                }}, function(err){
                if(err)
                    throw err;
            })
        });
        socket.on('Accept', function (data) {
            var myId = data.myData.id;
            var friendId = data.friendData[0];
            socket.emit('changeFriendstatus',{friendId: friendId});
            socket.broadcast.emit('changeFriendstatus',{friendId: myId});

            User.update({'user_id':myId,friends: {$elemMatch:{friendId: friendId}}},
                {$set:  {'friends.$.status': 'friends'}}, function(err){
                    if(err)
                        throw err;
                    else
                        socket.emit('changeFriendstatus',{friendId: friendId});

                });
            User.update({'user_id':friendId,friends: {$elemMatch:{friendId: myId}}},
                {$set:  {'friends.$.status': 'friends'}}, function(err){
                    if(err)
                        throw err;
                    else
                        socket.broadcast.emit('changeFriendstatus',{friendId: myId});
                });
        });
        socket.on('Remove request',function (data) {
            var myId = data.myData.id;
            var friendId = data.friendData[0];
            User.update({'user_id':myId,friends: {$elemMatch:{friendId: friendId}}},
                {$pull: {friends: {'friendId': friendId}}},function (err) {
                    if(err)
                        throw err;
                    else
                        socket.emit('removeFriendstatus',{friendId: friendId});

                });
            User.update({'user_id':friendId,friends: {$elemMatch:{friendId: myId}}},
                {$pull: {friends: {'friendId': myId}}},function (err) {
                    if(err)
                        throw err;
                    else
                        socket.broadcast.emit('removeFriendstatus',{friendId: myId});

                });



        });
        socket.on('fetchSearches', function (data) {
            User.findOne({'user_id': data.for}, {searches: 1}, function(err, res){
                if(err)
                    throw err;
                else{
                    if(res.searches.length > 0){
                        socket.emit('existingSearch', {res: res.searches});
                    }
                }
            })
        });
        socket.on('clearSearch', function(data){
            User.update({'user_id': data.for}, {$set: {searches: []}}, function (err) {
                if(err)
                    throw err;
            });
        });
        socket.on('checkFriends', function (data) {
            User.findOne({'user_id': data.friendId},{friends: 1},function (err, result) {
                if(err)
                    throw err;
                else{
                    if(result){
                        var Friendstatus;
                        result.friends.forEach(function(friend, index){
                            if(friend.friendId == data.myId){
                                Friendstatus = friend.status;
                                if(Friendstatus == 'Accept'){
                                    Friendstatus = 'Remove request'
                                }else if(Friendstatus == 'Remove request'){
                                    Friendstatus = 'Accept'
                                }
                            }
                        });
                        socket.emit('checkedFriends', {
                            status: Friendstatus,
                            friends: result.friends
                        })
                    }
                }
            })
        });
        socket.on('getInfoOfUser', function (data) {
            User.findOne({'user_id': data.myId},{searches: 0},function (err, results) {
                if(err)
                    throw err;
                else if(results.friends){
                    socket.emit('userInformation', results);
                }
            })
        });
        //making group
        socket.on('makeGroup', function (data) {
            var gettime = getTime();
            data.group_id = gettime[2];
            socket.emit('AddGroup',data );
            socket.broadcast.emit('AddGroup',data );

            var basicGrp = {
                group_id: data.group_id,
                groupName: data.groupName,
                groupNumber: data.groupMembers.length,
                groupImage: data.groupImage,
                groupAdmin: data.groupAdmin
            };
            data.groupMembers.forEach(function(member){
                User.update({'user_id': member.memberId},
                    {$push: {groups: basicGrp}},function (err) {
                        if(err)
                            throw err;
                    })
            });
            var newGroup = new Group();
            newGroup.group_id = basicGrp.group_id;
            newGroup.groupName = basicGrp.groupName;
            newGroup.groupImage = basicGrp.groupImage;
            newGroup.groupAdmin = basicGrp.groupAdmin;
            newGroup.groupMembers = data.groupMembers;
            newGroup.save(function (err) {
                if(err)
                    throw err;
            })
        });
        //action group
        socket.on('groupAction', function (data) {
            var action = data.action;
            var id = parseInt(data.id);
            Group.findOne({'group_id': id},function (err, group) {
                if(err)
                    throw err;
                if(group){
                    switch(action){
                        case 'delete':
                            User.update({'groups.group_id': data.id},
                                {$pull: {groups: {group_id: data.id}}},
                                {multi: true},
                                function(err){
                                    if(err)
                                        throw err;
                                    else {

                                        Group.remove({'group_id': data.id},function (err) {
                                            if(err)
                                                throw err;
                                        })
                                    }

                                });
                            User.update({'chats.dateMic': data.id},
                                {$pull: {chats: {dateMic: data.id}}},
                                {multi: true},
                                function(err){
                                    if(err)
                                        throw err;
                                    else {

                                        Group.remove({'group_id': data.id},function (err) {
                                            if(err)
                                                throw err;
                                        })
                                    }

                                });
                            Message.remove({'toId': data.id}, function (err) {
                                if(err)
                                    throw err;
                            });
                            socket.emit('groupDeleted', data);
                            socket.broadcast.emit('groupDeleted', data);
                            break;
                        case 'information':
                            socket.emit('ViewGroup', group);
                            break

                    }

                }
            });

        });
        //updating image
        socket.on('updateUserImage', function(data){
            socket.emit('updateUserImage' ,data);
            socket.broadcast.emit('updateUserImage' ,data);
        });
        //searching for a person
        socket.on('searchPerson', function(data){
            var value = data.value;
            var datam;
            User.find({"fullname" : { '$regex' : value, '$options' : 'i' }},{fullname: 1, profile_pic: 1, user_id: 1}, function (err, res) {
                if(err)
                    throw err;
                else{
                    if(res.length > 0){
                        datam = ['found', res];
                    }else{
                        datam = ['Not found'];
                    }
                    socket.emit('searchPerson', {data: datam})

                }
            });
        });
        socket.on('newSearch', function(data){
            User.update({'user_id': data.from}, {$pull: {searches: data.info}},function () {
                User.update({'user_id': data.from}, {$push: {searches: data.info} }, function (err) {
                    if(err)
                        throw err;
                })
            });
        });
        socket.on('adminAction', function(data){
            switch(data.action) {
                case 'addFriend':
                    Group.update({'group_id': data.groupId},
                        {$push: {groupMembers: data.member}}, function (err) {
                            if (err)
                                throw err;
                        });
                    User.update({'groups.group_id': data.groupId},
                        {$inc: {'groups.$.groupNumber': 1}},{multi: true}, function (err) {
                            if(err)
                                throw err;
                        });
                    var group = data.group;
                    var basicGrp = {
                        group_id: group.group_id,
                        groupName: group.groupName,
                        groupNumber: data.num + 1,
                        groupImage: group.groupImage,
                        groupAdmin: group.groupAdmin

                    };
                    User.update({'user_id': data.member.memberId},
                        {$push: {groups: basicGrp}},function (err) {
                            if(err)
                                throw err;
                        });

                    break;
                case 'removeFriend':
                    Group.update({'group_id': data.groupId},
                        {$pull: {groupMembers: data.member}}, function (err) {
                            if (err)
                                throw err;
                        });
                    User.update({'groups.group_id': data.groupId},
                        {$inc: {'groups.$.groupNumber': -1}},
                        {multi: true}, function(err){
                            if(err)
                                throw err;
                        });
                    User.update({'user_id': data.member.memberId},
                        {$pull: {chats: {dateMic: data.groupId}}},
                        function(err){
                            if(err)
                                throw err;
                        });
                    User.update({'user_id': data.member.memberId},
                        {$pull: {groups: {group_id: data.groupId}}},
                        function(err){
                            if(err)
                                throw err;
                        });
                    break;
            }

            socket.emit('memberAdded', data);
            socket.broadcast.emit('memberAdded', data);
        });
        socket.on('fetchGallery', function(){
            Post.find({}, function (err, data) {
                if(err)
                    throw err;
                else
                    socket.emit('galleryRes',data);
            });
        });
        //saving an event
        socket.on('saveEvent', function(data){
            User.update({'user_id': data.owner},
                {$push:{events: data}},function (err) {
                    if(err)
                        throw err;
                    else{
                        socket.emit('eventAdded', data);
                    }
                })
        });
        //fetchPeopl who are interested
        socket.on('fetchInterestedUsers', function(data){
             User.find({'user_id': {$in: data.data}}, {username: 1, profile_pic: 1, fullname: 1, user_id: 1}, function(err, res){
                 if(err)
                     throw err;
                 else{
                        socket.emit('interestsFound', {data: res});
                 }
             })
        });
        //interested
        socket.on('interested', function(data){
           socket.emit('interested', data);
            User.updateOne({events: {$elemMatch: {unique: data.eventId}}},
                {$push: {'events.$.peopleInterested': data.myId}}, function (err) {
                    if (err)
                        throw err;
                });
        });
        //get events
        socket.on('getEvents', function () {
            var events = [];
            User.find({},{events: 1, user_id: 1, fullname: 1, profile_pic: 1  },function(err, res){
                if (err)
                    throw err;
                else if(res){
                    res.forEach(function (value) {
                        if(value.events.length > 0){
                          value.events.forEach(function (value2) {
                              events.push({
                                  event: value2,
                                  user_id: value.user_id,
                                  fullname: value.fullname,
                                  pic: value.profile_pic
                              })
                          })
                        }
                    });

                }
                socket.emit('eventsFound', events);
            })
        });
        //deleteEvent
        socket.on('deleteEvent', function (data) {
            User.update({'user_id':data.user},
                {$pull: {events: data.event}},function (err) {
                    if(err)
                        throw err;
                    else{
                        socket.emit('deletedEvent', data);
                    }
                }
            )
        });
        socket.on('disconnect', function(){
            var users1 = [];
            users.map(function(item){
                if(users1.findIndex(m => m.id == item.id)){
                    users1.push(item);
                }
            });
            var indy = users1.findIndex(m => m.id == socket.prop);
            if(indy !== -1) {
                users1[indy].time = [getTime()[0], getTime()[1]];
                socket.broadcast.emit('updatIngState', {data: socket.prop, status: users1[indy].time});
            }
            users = users1;
        });
    });
    app.post('/app_API', function (req, res) {

        var data = req.body.data;
        var module = data[0];
        switch(module){
            case 'externalLogin':
                 User.findOne({'email':data[1].email}, function(error, user){
                    if(error)
                        throw error;
                    else if(user){
                        res.json(['success login',user]);
                    }else if(!user){
                        var userName = data[1].username;
                        User.find({'username':{ '$regex' : userName, '$options' : 'i' }}, {username: 1, _id: 0},function (err, response) {
                            if(err)
                                throw err;
                            else if(response.length > 0){
                                userName = checkUserName(response, userName);
                            }
                            var now = Date.now();
                            var newUser = new User();
                            newUser.user_id = now;
                            newUser.fullname = data[1].name;
                            newUser.email = data[1].email;
                            newUser.profile_pic = 'images/bigAvatar.jpg';
                            newUser.username =  userName;
                            newUser.location = '';
                            newUser.status = 'active';
                            newUser.save(function (err) {
                                if (err)
                                    throw err;
                                else {
                                    res.json(["successful login", newUser]);
                                }
                            });
                        });
                    }
                 });
                break;
            case 'updateStatus':
                User.update({'username': data[1]},{$set: {'status': 'active'}},function (err) {
                    if(err)
                        throw err;
                    else
                        res.json("Update")

                });
                break;
            case  'passVerify':
                var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                User.update({'username':data[1]},{$set: {'passCode': random_number}},function (err) {
                    if(err)
                        throw err;
                    else {
                        res.json(random_number);
                        var mailOptions = {
                            from: 'Christ-In account password reset',
                            to: data[2],
                            subject: 'Request for a password reset ✔',
                            html: 'Your are receiving this for a request on password reset. <br/>Please enter this verification code in order to continue.<br/><strong>' + random_number + '</strong>'
                        };
                        transporter.sendMail(mailOptions, function (error) {
                            if (error) {
                                console.log(error);
                            }
                        });
                    }
                })
                break;
            case 'updatePass':
                User.update({'username':data[1]},{$set: {'passCode':undefined}}, function(err){
                    if(err)
                        throw err;
                    else
                        res.json('updated');
                });
                break;
            case 'updatePassword':
                var newpass = new User();
                newpass.password = newpass.generatHarsh(data[2]);

                User.update({'username':data[1]},{$set:{'password':newpass.password}},function (err) {
                    if(err)
                        throw err;
                    else{
                        res.json('passupdate');
                    }
                });
                break;
            case 'signup':
                User.findOne({$or: [{'username': data[2]},{'email': data[3]},{'phone': data[4]}]},function (err, nameResult) {
                    if(err)
                        throw err;
                    else if(nameResult){
                        var err1;
                        var err2;
                        var err3;
                        if(nameResult.username ==  data[2]) {
                            err1 = 'User name is already registered.';
                        }
                        if(nameResult.email ==  data[3]) {
                            err2 = 'Email is already registered.';
                        }
                        if(nameResult.phone ==  data[4]) {
                            err3 = 'Phone number is already registered.';
                        }
                        res.json([err1, err2, err3]);
                    }else{
                        var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                        var now = Date.now();
                        var newUser = new User();
                        newUser.user_id = now;
                        newUser.fullname = data[1];
                        newUser.email = data[3];
                        newUser.password = newUser.generatHarsh(data[5]);
                        newUser.profile_pic = 'images/bigAvatar.jpg';
                        newUser.username =  data[2];
                        newUser.location = '';
                        newUser.status = random_number;
                        newUser.phone =  data[4];
                        newUser.gender = data[6];
                        newUser.pastor = data[7];
                        newUser.save(function (err) {
                            if(err)
                                throw err;
                            else{
                                res.json(["successful signup",newUser]);
                                var email_to = newUser.email;
                                var mailOptions = {
                                    from: 'Christ-In account signup confirmation',
                                    to: email_to,
                                    subject: 'Success registration to Christ-In Platform ✔',
                                    html: 'You have successfully registered to our platform. <br/>Please enter this verification code in order to continue.<br/><strong>' + newUser.status + '</strong>'
                                };
                                transporter.sendMail(mailOptions, function (error) {
                                    if (error) {
                                        console.log(error);
                                    }
                                });
                            }
                        })
                    }
                });
                break;
            case 'login':
                User.findOne({$or: [{'username': data[1]},{'email':data[1]}]},function (err, user) {
                    if(err)
                        throw err;
                    else if(!user){
                        res.json(['The user name or email is not registered.'])
                    }else if(user){
                        if(!user.validPassword(data[2])){
                            res.json(['The password you entered is invalid'])
                        }else if(user.status !=='active'){
                            res.json(['Incomplete signup',user]);
                        }else{
                            res.json(['success login',user]);
                        }
                    }
                });
                break;
            case 'verifyLogin':
                var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                User.update({'username': data[1]},{$set: {'status': random_number}},function (err) {
                    if(err)
                        throw err;
                    else{
                        res.json(random_number);
                        var mailOptions = {
                            from: 'Christ-In account new confirmation code',
                            to: data[2],
                            subject: 'Request for a new verification code ✔',
                            html: 'You have successfully received a new verification code. <br/>Please enter this verification code in order to continue.<br/><strong>' + random_number + '</strong>'
                        };
                        transporter.sendMail(mailOptions, function (error) {
                            if (error) {
                                console.log(error);
                            }
                        });
                    }
                })
                break;
            case 'checkUser':
                var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                User.findOne({$or:[{'username':data[1]},{'email':data[1]}]},function (err, user) {
                    if(err)
                        throw err;
                    else if(user) {

                        if(!user.passCode) {
                            User.update({$or: [{'username': data[1]}, {'email': data[1]}]}, {$set: {'passCode': random_number}}, function (err) {
                                if (err)
                                    throw err;
                                res.json([user,random_number]);
                            });
                            var mailOptions = {
                                from: 'Christ-In account password reset',
                                to: user.email,
                                subject: 'Request for a password reset ✔',
                                html: 'Your are receiving this for a request on password reset. <br/>Please enter this verification code in order to continue.<br/><strong>' + random_number + '</strong>'
                            };
                            transporter.sendMail(mailOptions, function (error) {
                                if (error) {
                                    console.log(error);
                                }
                            });
                        }else{
                            res.json([user, user.passCode]);
                        }


                    }
                    else if(!user)
                        res.json("Not found");
                });
                break;
        }
    });
    app.post('/imageUpload',function(req, res) {
        upload(req, res, function (err) {
            if (err)
                console.log(err);
            var data = req.body;
            var picUrl = 'uploads/' + req.file.filename;
            if(data.module == 'newMess') {
                res.status(201).json(picUrl + '~' + data.unique);
            }else if(data.module == 'status'){
                var datam = JSON.parse([data.myData]);

                Status.findOne({'ownerId': datam[2]},function(err, results){
                    if(err)
                        throw err;
                    else if(results){
                        Status.updateOne({'ownerId': datam[2]},{$push:{
                                images:{
                                    url: picUrl,
                                    time:data.time
                                }
                            }},function (err) {
                            if(err)
                                throw err;
                        })
                    }else{
                        var newStatus = new Status();
                        newStatus.id = datam;
                        newStatus.images = {
                            url: picUrl,
                            time: data.time
                        };
                        newStatus.ownerId = datam[2]
                        newStatus.save(function (err) {
                            if(err)
                                throw err;
                            else
                                res.status(201).json(picUrl);
                        })
                    }
                })
            }else if(data.module == 'post'){
                //makenewpost
                var postNo;
                var data = req.body;
                Post.findOne({'postOwner': data.postOwner}, function(err, post){
                    if(err)
                        throw err;
                    else if(post){
                        postNo =  post.postNumber
                    }else{
                        postNo = 0;
                    }
                    var gettime =  getTime();
                    var newPost = new Post();
                    newPost.postId = gettime[2];
                    newPost.postOwner =  data.postOwner;
                    newPost.postOwnerImage =  data.postOwnerImage;
                    newPost.postOwnerNames =  data.postOwnerNames;
                    newPost.postDate =  gettime[0];
                    newPost.postText =  data.postText;
                    newPost.postImage =  picUrl;
                    newPost.postLikes =  0;
                    newPost.postComments = 0;
                    newPost.postTime =  gettime[1];
                    newPost.postNumber =  parseInt(postNo) + 1;
                    newPost.save(function (err) {
                        if(err)
                            throw err;
                        else
                            res.status(201).json(newPost);

                    })
                });

            }else{
                console.log(data);
            }

        })
    });
    app.post('/imageUpload1', function(req, res) {
        upload(req, res, function (err) {
            if (err)
                console.log(err);
            else
                var profile_pic_url = 'uploads/' + req.file.filename;
            //  var userName = req.body.username.trim();
            var data = req.body.info;
            var module = req.body.module;
            if (module == 'UploadingProfileImage') {
                res.status(201).json(profile_pic_url);
                User.findOne({'user_id': data}, function (err, user) {
                    if (err)
                        throw err;
                    else {
                        var imageurl = user.profile_pic;
                        console.log(imageurl);
                        var imagefolder = imageurl.split('/');
                        if (imagefolder[0] == 'uploads') {
                            fs.unlink('public/' + imageurl, function () {
                            });
                        }
                    }
                });
                User.update({'user_id': data}, {$set: {'profile_pic': profile_pic_url}}, function (err) {
                    if (err)
                        throw err;
                });
                Post.update({'postOwner': data},
                    {$set: {'postOwnerImage': profile_pic_url}}, {multi: true}, function (err) {
                        if (err)
                            throw err;
                    });
                console.log(data);
                Status.updateOne({'ownerId': data}, {$set: {'id.1': profile_pic_url}}, function (err) {
                    if (err)
                        throw err;
                });
                Comment.update({'commentId': data},
                    {$set: {'commentOwnerImage': profile_pic_url}}, {multi: true}, function (err) {
                        if (err)
                            throw err;
                    });
                Like.update({'likeId': data},
                    {$set: {'postOwnerImage': profile_pic_url}}, {multi: true}, function (err) {
                        if (err)
                            throw err;
                    });

                User.update({'chats.dateMic': data},
                    {$set: {'chats.$.image': profile_pic_url}}, {multi: true},
                    function (err, r) {
                        if (err)
                            throw err;
                    });
                User.update({'friends.friendId': data},
                    {$set: {'friends.$.image': profile_pic_url}}, {multi: true},
                    function (err) {
                        if (err)
                            throw err;
                    });
                Group.update({'groupMembers.memberId': data},
                    {$set: {'groupMembers.$.memimage': profile_pic_url}}, {multi: true},
                    function (err) {
                        if (err)
                            throw err;
                    });
            }
        });
    });
    app.post('/imageUpload2', function(req, res) {
        upload(req, res, function (err) {
            if (err)
                console.log(err);
            else
                var pic = 'uploads/' + req.file.filename;
            User.updateOne({'user_id': req.body.owner, events: {$elemMatch: {unique: req.body.unique}}},
                {$set: {'events.$.eventImage': pic}}, function (err) {
                    if (err)
                        throw err;
                });
            res.status(201).json(pic);
        })
    })
};
function fetchData(data, postIndex, socket, criteria){

    User.findOne({'user_id':data.userId},{searches: 0},function (err, user) {
        if (err)
            throw err;
        else if(postIndex == 0);
            socket.emit('userInfo', {user: user});
        var friends = [];
        user.friends.map(function (friend) {
            friends.push(friend.friendId);
        });
        friends.push(user.user_id);
        if(!criteria)
            criteria = {'notSee.id': {$ne: data.userId} };
        else if(criteria == 'greater')
            criteria = {'notSee.id': {$ne: data.userId}, 'postId': {$gt: postIndex} };
        else
            criteria = {'notSee.id': {$ne: data.userId}, 'postId': {$lt: postIndex} };
        Post.find(criteria, function (err, results) {
            if (err)
                throw err;
            else {
                if (results) {
                    Status.find({}, function (err, resl) {
                        if (err)
                            throw err;
                        else {
                            User.aggregate(
                                [{$match: {'user_id': {$nin: friends}}},
                                    {$sample: {size: 10}}
                                ]
                            ).exec(function (err, people) {
                                if (err)
                                    throw err;
                                else {
                                    var peopeYouMayKnow = [];
                                    people.map(function (person) {
                                        peopeYouMayKnow.push({
                                            username: person.username,
                                            profile_pic: person.profile_pic,
                                            email: person.email,
                                            fullname: person.fullname,
                                            user_id: person.user_id
                                        })
                                    });
                                    socket.emit('randomPost', {
                                        data: results,
                                        statuses: resl,
                                        people: peopeYouMayKnow,
                                        postIndex: postIndex
                                    });
                                    if (results.length > 0) {
                                        var checks  = results.map((q)=>q.postId);
                                        Like.find({'likeId': data.userId, 'postId': {$in: checks}}, {postId: 1, _id:0}, function (err, reslt) {
                                            if (err)
                                                throw(err);
                                            else if (reslt) {
                                                socket.emit('likedPost', reslt.map((q)=>q.postId));
                                            }
                                        })

                                    }

                                }
                            });
                        }
                    });


                }
            }
        }).limit(6).sort({$natural: -1});
    });
}

function checkUserName(array, username){
    var user;
    for(x = -1; x <= 1000; x++){
        if(x == -1){
            user = username;
        }else{
            user = username +''+x;
        }
        if(array.findIndex(q => q.username == user) == -1){
            break;
        }
    }
    return user;
}
function getTime(){
    var today = new Date();
    var now = Date.now();
    var  date = today.getDate()+'/'+parseInt(today.getMonth()+1)+'/'+ today.getFullYear();
    var hours = today.getHours();
    var minutes = today.getMinutes();
    if(hours < 10){
        hours = '0'+hours;
    }else{
        hours = hours;
    }
    if(minutes < 10){
        minutes = '0'+minutes;
    }else{
        minutes = minutes;
    }
    var time = hours + ':'+minutes;
    data = [date, time, now];
    return data;
}