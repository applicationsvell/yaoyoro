# 札の一覧を作る（cards.json を書き出す）。数字を変えたいときはここを直して実行する
# 第5版：すべての札は4枚ずつ。はじめの手札は10枚で、使った札の数だけあとで引く
# 第10版：道具は5枚ずつ、体力を回復する道具（おにぎり・三色団子・薬湯・仙桃）は8枚ずつに増やした
# 第12版：召喚札は20枚。体力・霊力・小判の道具は＋5と＋10が20枚、＋15と＋20が10枚
# 第13版：札はだれにでも使える。ハプニング札（暴れ独楽・狸の化け葉・福笑い）を追加（ハプニング「なし」の部屋では入らない）
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
N = 4        # 武器・防具・術・追撃・召喚は4枚
N_ITEM = 5   # 道具は5枚（下の表にあるものはその枚数）
COUNT = {
    'shokan': 20,                                                       # 召喚札
    'onigiri': 20, 'dango': 20, 'yakuto': 10, 'sento': 10,              # 体力＋5・＋10・＋15・＋20
    'reisui': 20, 'reiyaku': 20, 'magatama': 10, 'hoju': 10,            # 霊力＋5・＋10・＋15・＋20
    'zenibukuro': 20, 'koban': 20, 'senryobako': 10, 'kozuchi': 10,     # 小判＋5・＋10・＋15・＋20
    'bakeha': 3, 'fukuwarai': 3,                                        # ハプニング札（道具）
}
cards = []


def W(id, name, yomi, atk, price, elem=None, all=False, fx=None, chaos=False):
    c = {'id': id, 'name': name, 'yomi': yomi, 'type': 'weapon', 'atk': atk, 'price': price, 'n': N}
    if elem: c['elem'] = elem
    if all: c['all'] = True
    if fx: c['fx'] = fx
    if chaos: c['chaos'] = True   # ハプニング札
    cards.append(c)


def A(id, name, yomi, d, price, elem=None, special=None, magic=False):
    c = {'id': id, 'name': name, 'yomi': yomi, 'type': 'armor', 'price': price, 'n': N}
    if d is not None: c['def'] = d
    if elem: c['elem'] = elem
    if special: c['special'] = special
    if magic: c['magic'] = True
    cards.append(c)


def S(id, name, yomi, mp, eff, val, tgt, price, elem=None, nodef=False):
    c = {'id': id, 'name': name, 'yomi': yomi, 'type': 'spell', 'mp': mp, 'eff': eff, 'val': val, 'tgt': tgt, 'price': price, 'n': N}
    if elem: c['elem'] = elem
    if nodef: c['nodef'] = True  # 守れない
    cards.append(c)


def I(id, name, yomi, eff, val, price, tgt=None, chaos=False):
    c = {'id': id, 'name': name, 'yomi': yomi, 'type': 'item', 'eff': eff, 'val': val, 'price': price, 'n': COUNT.get(id, N_ITEM)}
    if tgt: c['tgt'] = tgt
    if chaos: c['chaos'] = True   # ハプニング札
    cards.append(c)


# ---- 武器：無属性（1〜15・30）。無属性どうしは重ねられない（追撃札だけ足せる）
W('shuto', '手刀', 'しゅとう', 1, 1)
W('bokken', '木刀', 'ぼくとう', 3, 1)
W('dounokatana', '銅の刀', 'どうのかたな', 1, 10)
W('ginnokatana', '銀の刀', 'ぎんのかたな', 1, 20)
W('kinnokatana', '金の刀', 'きんのかたな', 1, 30)
W('takeyari', '竹槍', 'たけやり', 2, 3)
W('kama', '鎌', 'かま', 2, 2)
W('kunai', '苦無', 'くない', 3, 4)
W('hocho', '包丁', 'ほうちょう', 3, 3)
W('konbo', '棍棒', 'こんぼう', 4, 5)
W('jitte', '十手', 'じって', 4, 4)
W('kusarigama', '鎖鎌', 'くさりがま', 4, 7, fx='draw')
W('wakizashi', '脇差', 'わきざし', 5, 7)
W('shakujo', '錫杖', 'しゃくじょう', 5, 6)
W('naginata', '薙刀', 'なぎなた', 6, 9)
W('kodachi', '小太刀', 'こだち', 6, 8)
W('katana', '太刀', 'たち', 7, 10)
W('nagayari', '長槍', 'ながやり', 7, 9)
W('jumonji', '十文字槍', 'じゅうもんじやり', 8, 11)
W('uchigatana', '打刀', 'うちがたな', 8, 10)
W('kanabo', '金棒', 'かなぼう', 9, 13)
W('nodachi', '野太刀', 'のだち', 9, 12)
W('odachi', '大太刀', 'おおだち', 10, 14)
W('zanbato', '斬馬刀', 'ざんばとう', 11, 16)
W('masakari', '大鉞', 'おおまさかり', 12, 17)
W('yakumo', '神剣・八雲', 'しんけん・やくも', 13, 19)
W('onikiri', '鬼斬り', 'おにきり', 14, 20, fx='draw')
W('habakiri', '天羽々斬', 'あめのはばきり', 15, 22)
W('murakumo', '天叢雲剣', 'あめのむらくものつるぎ', 30, 30)
W('yabusuma', '矢ぶすま', 'やぶすま', 3, 1, all=True)
W('horoku', '焙烙玉', 'ほうろくだま', 4, 8, all=True)
W('ozutsu', '大筒', 'おおづつ', 6, 1, all=True)
# ---- ハプニング札：だれに当たるか分からない大技（自分以外のだれか。味方のことも）
W('abaregoma', '暴れ独楽', 'あばれごま', 12, 5, fx='rand', chaos=True)
# ---- 武器：属性つき（2〜7）。同じ属性の守札でしか守れない。同じ属性どうしは重ねられる
W('hinoko', '火の粉', 'ひのこ', 2, 3, '火')
W('hiya', '火矢', 'ひや', 4, 6, '火')
W('homura', '焔の太刀', 'ほむらのたち', 7, 11, '火')
W('kaensha', '火炎車', 'かえんしゃ', 5, 16, '火', all=True)
W('mizutsubute', '水礫', 'みずつぶて', 2, 3, '水')
W('suijin', '水刃', 'すいじん', 4, 6, '水')
W('tsurara', '氷柱', 'つらら', 6, 9, '水')
W('mizuchi', '蛟の鉾', 'みずちのほこ', 7, 11, '水')
W('samidare', '五月雨の弓', 'さみだれのゆみ', 3, 9, '水', all=True)
W('matsuba', '松葉針', 'まつばばり', 2, 3, '木')
W('ibara', '茨の鞭', 'いばらのむち', 3, 5, '木', fx='draw')
W('kashi', '樫の棍', 'かしのこん', 6, 9, '木')
W('senpu', '旋風の扇', 'せんぷうのおうぎ', 4, 12, '木', all=True)
W('sunakake', '砂かけ', 'すなかけ', 2, 3, '土')
W('ishi', '石つぶて', 'いしつぶて', 3, 5, '土')
W('iwakudaki', '岩砕き', 'いわくだき', 6, 9, '土')
W('jiware', '地割れの槌', 'じわれのつち', 4, 12, '土', all=True)
W('kanzashi', '銀の簪', 'ぎんのかんざし', 2, 3, '金')
W('shuriken', '手裏剣', 'しゅりけん', 3, 5, '金', fx='draw')
W('tessen', '鉄扇', 'てっせん', 5, 8, '金')
W('hagane', '鋼の矛', 'はがねのほこ', 7, 11, '金')
# ---- 追撃
for pid, name, yomi, atk, price in [('toishi', '砥石', 'といし', 2, 3), ('kiai', '気合', 'きあい', 3, 5), ('kairiki', '怪力', 'かいりき', 5, 9), ('toshinki', '闘神気', 'とうしんき', 10, 10)]:
    cards.append({'id': pid, 'name': name, 'yomi': yomi, 'type': 'plus', 'atk': atk, 'price': price, 'n': N})
# ---- 防具：無属性（無属性の攻撃と術だけ守れる）
A('tenugui', '手ぬぐい', 'てぬぐい', 1, 1)
A('nabebuta', '鍋のふた', 'なべのふた', 2, 2)
A('amigasa', '編み笠', 'あみがさ', 3, 4)
A('itadate', '板の盾', 'いたのたて', 4, 5)
A('kote', '籠手', 'こて', 5, 7)
A('domaru', '胴丸', 'どうまる', 6, 8)
A('katabira', '鎖帷子', 'くさりかたびら', 7, 9)
A('gusoku', '具足', 'ぐそく', 8, 11)
A('ooyoroi', '大鎧', 'おおよろい', 9, 12)
A('odate', '大盾', 'おおだて', 10, 13)
A('jomon', '城門の扉', 'じょうもんのとびら', 11, 15)
A('nanban', '南蛮胴', 'なんばんどう', 12, 16)
A('ishigaki', '石垣', 'いしがき', 13, 17)
A('tenshu', '天守の壁', 'てんしゅのかべ', 14, 19)
A('kongo', '金剛の鎧', 'こんごうのよろい', 15, 20)
A('iwato', '天岩戸', 'あまのいわと', 30, 30)
# ---- 防具：属性つき（同じ属性の攻撃と、無属性の攻撃を守れる）
A('hiyoke', '火除けの札', 'ひよけのふだ', 3, 5, '火')
A('hinezumi', '火鼠の衣', 'ひねずみのころも', 6, 9, '火')
A('namiyoke', '波除け', 'なみよけ', 3, 5, '水')
A('ryusui', '流水の帯', 'りゅうすいのおび', 6, 9, '水')
A('wara', '藁の束', 'わらのたば', 3, 5, '木')
A('takegaki', '竹垣', 'たけがき', 6, 9, '木')
A('donabe', '土鍋のふた', 'どなべのふた', 3, 5, '土')
A('dorui', '土塁', 'どるい', 6, 9, '土')
A('kabuto', '鉄兜', 'てつかぶと', 3, 5, '金')
A('haganetate', '鋼の盾', 'はがねのたて', 6, 9, '金')
# ---- 防具：特別（属性に関係なく使える。1回に1枚）
A('kekkai', '結界札', 'けっかいふだ', 5, 10, magic=True)
A('kagami', '照魔の鏡', 'しょうまのかがみ', None, 20, special='reflect')
A('hauchiwa', '羽団扇', 'はうちわ', None, 16, special='deflect')
A('migawari', '身代わり人形', 'みがわりにんぎょう', None, 20, special='null')
A('minokasa', '隠れ蓑', 'かくれみの', None, 12, special='dodge')
# ---- 術
S('kitsunebi', '狐火', 'きつねび', 3, 'dmg', 6, 'enemy', 8, '火')
S('kamaitachi', '鎌鼬', 'かまいたち', 3, 'dmg', 5, 'enemy', 8, '木')
S('raimei', '雷鳴', 'らいめい', 5, 'dmg', 7, 'all', 6)
S('tsunami', '大津波', 'おおつなみ', 7, 'dmg', 10, 'all', 15, '水')
S('tamasui', '魂吸い', 'たますい', 5, 'drain', 5, 'enemy', 14)
S('noroi', '呪いの藁人形', 'のろいのわらにんぎょう', 4, 'curse', 3, 'enemy', 10)
S('fuin', '封印札', 'ふういんふだ', 2, 'seal', 2, 'enemy', 6)
S('kamikakushi', '神隠し', 'かみかくし', 4, 'steal', 1, 'enemy', 10, nodef=True)
S('iyashi', '癒しの舞', 'いやしのまい', 3, 'heal', 7, 'ally', 9)
S('kirigakure', '霧隠れの術', 'きりがくれのじゅつ', 3, 'mist', 1, 'self', 8)
# ---- 道具：体力・霊力・小判は ＋5 ＋10 ＋15 ＋20
I('onigiri', 'おにぎり', 'おにぎり', 'heal', 5, 5)
I('dango', '三色団子', 'さんしょくだんご', 'heal', 10, 9)
I('yakuto', '薬湯', 'やくとう', 'heal', 15, 13)
I('sento', '仙桃', 'せんとう', 'heal', 20, 17)
I('reisui', '霊水', 'れいすい', 'mp', 5, 5)
I('reiyaku', '霊薬', 'れいやく', 'mp', 10, 9)
I('magatama', '勾玉', 'まがたま', 'mp', 15, 13)
I('hoju', '宝珠', 'ほうじゅ', 'mp', 20, 17)
I('zenibukuro', '銭袋', 'ぜにぶくろ', 'gold', 5, 4)
I('koban', '小判袋', 'こばんぶくろ', 'gold', 10, 8)
I('senryobako', '千両箱', 'せんりょうばこ', 'gold', 15, 12)
I('kozuchi', '打ち出の小槌', 'うちでのこづち', 'gold', 20, 16)
I('omiki', '御神酒', 'おみき', 'kiai', 5, 7)
I('shio', '清めの塩', 'きよめのしお', 'cleanse', 3, 5)
I('maneki', '招き猫', 'まねきねこ', 'maneki', 15, 16)
I('jobutsu', '成仏札', 'じょうぶつふだ', 'jobutsu', 50, 6, 'beast')
I('sandatsu', '簒奪札', 'さんだつふだ', 'usurp', 0, 8, 'enemy')
I('oshiuri', '押し売り札', 'おしうりふだ', 'sell', 0, 8, 'foe')
I('seiren', '精錬札', 'せいれんふだ', 'refine', 5, 10)
# ---- ハプニング札（道具）
I('bakeha', '狸の化け葉', 'たぬきのばけは', 'hpswap', 0, 18, 'harm', chaos=True)
I('fukuwarai', '福笑い', 'ふくわらい', 'shuffle', 0, 6, chaos=True)
# ---- 召喚札：使うと霊獣がランダムで出てくる
cards.append({'id': 'shokan', 'name': '召喚札', 'yomi': 'しょうかんふだ', 'type': 'summon', 'mp': 3, 'price': 5, 'n': COUNT['shokan']})
beasts = [
    ('seiryu', '青龍', 'せいりゅう', '木', 'heal', 4, '持ち主の体力＋4'),
    ('suzaku', '朱雀', 'すざく', '火', 'burn', 3, '相手1人（ランダム）に火の3ダメージ。守れない'),
    ('byakko', '白虎', 'びゃっこ', '金', 'boost', 4, '持ち主の次の攻撃＋4'),
    ('genbu', '玄武', 'げんぶ', '水', 'shell', 5, '持ち主に甲羅。次に受けるダメージ−5'),
    ('kirin', '麒麟', 'きりん', '土', 'mp', 5, '持ち主の霊力＋5'),
    ('yatagarasu', '八咫烏', 'やたがらす', '', 'draw', 1, '持ち主が札を1枚引く'),
    ('komainu', '狛犬', 'こまいぬ', '土', 'cleanse', 5, '持ち主の呪い・封印をはらう。なければ体力＋5'),
    ('baku', '獏', 'ばく', '水', 'discard', 1, '相手1人（ランダム）の手札を1枚捨てさせる。まれに（5回に1回）自分の手札を捨ててしまう'),
    ('kinkei', '金鶏', 'きんけい', '金', 'gold', 6, '持ち主の小判＋6両'),
    ('shinigami', '死神', 'しにがみ', '', 'reaper', 5, '相手全員に5ダメージ。自分にも5ダメージ。守れない'),
]
B = []
for bid, name, yomi, el, eff, val, text in beasts:
    b = {'id': bid, 'name': name, 'yomi': yomi, 'eff': eff, 'val': val, 'text': text}
    if el: b['elem'] = el
    B.append(b)
# ---- 式神（札帳で書きかえてもらったもの）
guards = [
    {'id': 'tengu', 'name': '天狗', 'yomi': 'てんぐ', 'elem': '木', 'hp': 30, 'mp': 25, 'gold': 20, 'spellDiscount': 2, 'dodge': 0.1,
     'skill': '神通力', 'text': '術に使う霊力が2少ない。武器で攻められたとき、10回に1回くらいひらりとかわす'},
    {'id': 'kitsune', 'name': '九尾の狐', 'yomi': 'きゅうびのきつね', 'elem': '火', 'hp': 35, 'mp': 20, 'gold': 20, 'atkBonus': 3, 'elemBonusOf': '火', 'elemBonus': 5, 'fireImmune': True,
     'skill': '狐火の化身', 'text': '攻撃と術のダメージ＋3。火の攻撃と術ならさらに＋5。火の攻撃ではダメージを受けない'},
    {'id': 'gama', 'name': '大蝦蟇', 'yomi': 'おおがま', 'elem': '土', 'hp': 40, 'mp': 15, 'gold': 20, 'armorBonus': 3,
     'skill': '鉄壁の腹', 'text': '防具を出して守るとき、守り＋3'},
    {'id': 'oni', 'name': '天邪鬼', 'yomi': 'あまのじゃく', 'elem': '金', 'hp': 30, 'mp': 25, 'gold': 20, 'deflectRate': 0.4,
     'skill': '幻惑', 'text': '武器で攻められたとき、40%の確率で攻撃を弾く（弾いた攻撃は流れ弾になって全員の中からランダムに1人に飛ぶ。飛んだ先の人は守札で守れる）'},
    {'id': 'ryujin', 'name': '龍神', 'yomi': 'りゅうじん', 'elem': '水', 'hp': 60, 'mp': 15, 'gold': 20, 'noSummon': True, 'noMpGain': True, 'weaponBonus': 5, 'armorHalf': True,
     'skill': '龍神の加護', 'text': '霊獣を連れられない（召喚札はほかの人に使える）。霊力は増えない。武器の攻撃＋5。自分の守札の守りは半分になる'},
]
# ---- 天候（札帳で書きかえてもらったもの）
weathers = [
    {'id': 'haru', 'name': '春一番', 'yomi': 'はるいちばん', 'kind': 'random', 'crest': '木', 'text': '攻める相手がランダムになる（味方に当たることも！）'},
    {'id': 'enten', 'name': '炎天', 'yomi': 'えんてん', 'kind': 'power', 'bonus': 2, 'crest': '火', 'text': '攻撃と術のダメージ＋2'},
    {'id': 'jinari', 'name': '地鳴り', 'yomi': 'じなり', 'kind': 'power', 'bonus': -2, 'crest': '土', 'text': '攻撃と術のダメージ−2'},
    {'id': 'shuso', 'name': '秋霜', 'yomi': 'しゅうそう', 'kind': 'onecard', 'crest': '金', 'text': '守るときに出せる札は1枚まで'},
    {'id': 'tsuyu', 'name': '梅雨', 'yomi': 'つゆ', 'kind': 'nospell', 'crest': '水', 'text': '術が使えない'},
    {'id': 'nagi', 'name': '凪', 'yomi': 'なぎ', 'kind': 'calm', 'text': '何も起きない、静かな巡'},
    {'id': 'ennichi', 'name': '縁日', 'yomi': 'えんにち', 'kind': 'fair', 'shop': 5, 'text': 'よろず屋の値段が半分。棚の札が5枚になる'},
    {'id': 'mangetsu', 'name': '満月', 'yomi': 'まんげつ', 'kind': 'moon', 'cut': 3, 'text': '術に使う霊力が3少ない'},
    {'id': 'arashi', 'name': '野分', 'yomi': 'のわき', 'kind': 'storm', 'text': '番のはじめに札を1枚引ける'},
]
out = {'version': 4, 'guardians': guards, 'weathers': weathers, 'beasts': B, 'cards': cards}
json.dump(out, open(os.path.join(HERE, 'cards.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
ids = [c['id'] for c in cards]
assert len(ids) == len(set(ids)), 'dup id'
assert all(c['n'] == COUNT.get(c['id'], N_ITEM if c['type'] == 'item' else N) for c in cards)
w = [c for c in cards if c['type'] == 'weapon']
nw = sum(1 for c in w if not c.get('elem'))
print('札の種類', len(cards), '枚数', sum(c['n'] for c in cards), '武器の種類', len(w), '無属性', nw, '(%d%%)' % (100 * nw / len(w)))
for t in ['weapon', 'plus', 'armor', 'spell', 'item', 'summon']:
    print(' ', t, sum(1 for c in cards if c['type'] == t), '種類')
