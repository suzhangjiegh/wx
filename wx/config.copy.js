module.exports = {
	grant_type: 'client_credential',
	appid: '',
	secret: '',
	pay:{
		mch_id:'',/*商户号*/
		noncestr:'Wm3WZYTPz0wzccnW',
		trade_type:'JSAPI',
 		key:'123456789012345678901234567890Ab',
	},
	authenUrl:'',//oauth2.0回调 例如本程序为 'http://xx.xxx.com/wx/authen' xx.xxx.com为服务器域名
	jssdkUrl:''//jssdk网页的url 例如本程序为 'http://xx.xxx.com/wx/jssdk' xx.xxx.com为服务器域名
	payUrl:''
};
