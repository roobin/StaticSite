var sha1 = require('../libs/crypto/sha1'),
	aes = require('../libs/crypto/aes'),
	EventEmitter = require('events').EventEmitter,
	promises = require('../libs/promises'),
	_ = require('underscore'),
	s3 = require('../libs/s3').s3;


var bucket,
	bucketName = location.pathname.replace(/^\/([^\/]+).*/, '$1'),
	path = '/' + bucketName + '/admin/';


var auth = module.exports = _.extend(new EventEmitter, {
	
	login: function(username, password, remember) {
		var deferred = new promises.Deferred();
		var usernameSha = sha1.hash(username);
		var passwordSha = sha1.hash(password);
		
		$.get('auth/' + usernameSha).then(function(cypher) {
			var values = aes.decrypt(cypher, passwordSha, 256).split(':');
			
			if (values.length === 3 && values[0] === usernameSha) {
				s3.auth(values[1], values[2]);
				var creds = username + ':' + values[1] + ':' + values[2];
				bucket = s3.bucket(bucketName);
				bucket.list('admin/auth/' + usernameSha).then(function() {
					sessionStorage.setItem('creds', creds);
					if (remember) localStorage.setItem('creds', creds);
					
					deferred.fulfill();
				}, function(error) {
					deferred.fail(error);
				});
			} else {
				deferred.fail(new Error('Incorrect Password'));
			}
		}, function() {
			deferred.fail(new Error('Incorrect Username'));
		});
		return deferred.promise;
	},
	
	register: function(key, secret, username, password) {
		s3.auth(key, secret);
		bucket = s3.bucket(bucketName);
		username = sha1.hash(username);
		password = sha1.hash(password);
		var cypher = aes.encrypt([username, key, secret].join(':'), password, 256);
		
		// if we can successfully put this file to the bucket then we have access and are logged in
		return bucket.put('admin/auth/' + username, cypher, { acl: 'public-read' });
	}
});
