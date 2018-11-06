var mongoose = require('mongoose');
var commentsSchema = new mongoose.Schema({
    postId: String,
    commentId: String,
    commentdate: String,
    commentTime: String,
    commetimeId: String,
    commentText: String,
    commentOwnerImage: String,
    commentNames: String
});

module.exports = mongoose.model('comments', commentsSchema);