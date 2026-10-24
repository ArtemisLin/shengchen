// 收件箱（私有仓库）和加密公钥。私钥只在谷雨电脑上：~/.config/guyu-shengchen/secret.key
window.SHENGCHEN = {
  repo: 'ArtemisLin/shengchen-data',
  pub: '2J+QWnfXq4EQxtMmL8BTrBfffPfgumw1mgk81PShABg=',
  // 每天几点开始签到（北京时间）；交八字的第二天起，到了这个钟点才出现签到按钮
  signinOpen: '10:00',
  // 签到暗号（谷雨课上念）只存指纹，不存原文；换暗号：node -e 见 HANDOFF「交八字＋签到」。留空＝不要暗号
  signinCode: 'KUPs/7QIgGxqZxdvB3z69w=='
};
