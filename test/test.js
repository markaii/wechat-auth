// 简单测试，仅供参考

var Auth = require('../lib/auth');

var appid = "xxx";
var appsecret = "xxx";

var mpappid = "xjkfda";


var getVerifyTicket = function(callback) {
  callback(null, "ticket@@@c4-LQoYhsWq");
};

var getComponentToken = function(callback) {
  callback(null, null);
};

var saveComponentToken = function(callback) {
  callback(null);
};

var wxauth = new Auth(appid, appsecret, getVerifyTicket, getComponentToken, saveComponentToken);

var redirect_uri = "http://baidu.com";
var oauthUrl = wxauth.getOAuthURL(mpappid, redirect_uri, '', 'snsapi_base');
console.log(oauthUrl);

wxauth.getPreAuthCode(function(err, data) {
  if(err) {
    console.log(err);
    return;
  }
  console.log(data);
});
