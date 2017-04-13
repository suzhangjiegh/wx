var express = require('express');
var router = express.Router();

var wxconfig =require('../wx/config');
var wxlogin =require('../wx/wxapi');

var async = require('async');



/**
 * localhost/wx/code
 * [description]
 * @param  {[type]} req   [description]
 * @param  {[type]} res   [description]
 * @return {[type]}       [description]
 */
router.get('/code', function(req, res) {
	//回调的地址
	var redirect_url = wxconfig.authenUrl;
	var redirUrl = encodeURI(redirect_url);
	var url ='https://open.weixin.qq.com/connect/oauth2/authorize'+
        '?appid=' + wxconfig.appid +
        '&redirect_uri=' + redirUrl +
        '&response_type=code' +
        '&scope=snsapi_base' +
        '&state=STATE' + 
        '#wechat_redirect';
  
	res.redirect(url);
});

/**
 * [微信授权]
 */
router.get('/authen', function(req, res) {

	wxlogin.openid(req.query.code,function (data) {
		if (data.code ==200) {
			
			//req.session.openid = data.openid; 
			wxlogin.userInfo(data.openid,function (data1) {
				
				console.log(data1);
				res.render('wx/login',data1);
			});
		}else{
			//res.redirect('code');
		}
	});
});

/**
 * [微信下单]
 */
router.get('/pay',function (req, res) {
	//var ip = utils.getClientIp(req);
	//var openid = req.session.openid;
	var ip ='113.65.189.203';
	var openid = 'oviX3sruQFVwZ--Ze20mJa1kkSlw';
	var price = 1;
	//订单号
	var number = Date.parse(new Date());
	var notify_url = wxconfig.jssdkUrl;

	var tasklist = [];
	var data = {
		jsSDKMap:{},
		beforePayMap:{},
		mes:''
	};

	tasklist.push(function (callback) {
		var url = req.protocol + '://' + req.host + req.originalUrl; //获取当前url

		wxlogin.jsSDKMap(url,function(d){
			if (d.code ==200) {
				data.jsSDKMap = d.jsSDKMap;
				callback(null,data);
				return;
			}
			callback('err','jssdk错误');
			
		});
	});

	tasklist.push(function (n,callback) {
		wxlogin.beforePay(ip,openid,price,number,notify_url,function (d) {
			if (d.code ==200) {
				data.beforePayMap = d.beforePayMap;
				callback(null,data);
				return;
			}
			callback('err','订单错误');
			
		});
	});

	async.waterfall(tasklist, function (err, result) {

		console.log('---------result-----------');
		console.log(result);
		res.render('wx/pay',result);
	});	
});

/**
 * [微信卡卷]
 */
router.get('/wxcord',function (req, res) {


	var data = {
		jsSDKMap:{},
		wxCordMap:{},
		mes:''
	};

	var tasklist = [];
	tasklist.push(function (callback) {
		var url = req.protocol + '://' + req.host + req.originalUrl; //获取当前url

		wxlogin.jsSDKMap(url,function(d){
			if (d.code ==200) {
				data.jsSDKMap = d.jsSDKMap;
				callback(null,data);
				return;
			}
			callback('err','jssdk错误');
			
		});
	});

	tasklist.push(function (n,callback) {
		wxlogin.wxCordMap(function(d){
			if (d.code ==200) {
				data.wxCordMap = d.wxCordMap;
				callback(null,data);
				return;
			}
			callback('err','wxCordMap错误');
			
		});
	});

	async.waterfall(tasklist, function (err, result) {
	
		console.log('---------result-----------');
		console.log(result);
		res.render('wx/cord',result);
	});	

});




module.exports = router;





