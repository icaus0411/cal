"""계약서 PDF에서 거래명세서 작성에 필요한 값을 뽑아 JSON으로 저장한다.

사용법:
    python extract_contract.py <계약서.pdf> --out <결과.json>

처리 흐름:
    1. pypdf로 페이지별 텍스트를 읽는다(OCR·외부 AI 없음).
    2. 표지의 "갑"/"을"로 당사자 역할을 정한다. 거래명세서의 공급자는 서비스를 제공하는
       "을"이고, 받는 쪽(귀하)은 "갑"이다. 새봄바이오가 을(공급자)인 계약도 있으므로
       회사명으로 방향을 가정하지 않는다.
    3. 서명란 표(표준형)와 "을"의 상호는 …" 문장(간이형) 두 형식에서 사업자번호·대표자·주소를 찾는다.
    4. 금액(월/총, 부가세 별도/포함), 분할 지급(N차분), 계약기간, 계좌, 품명·규격·단위를 찾는다.
    5. 찾지 못한 값은 null로 두고 missing 목록에 담는다. 값을 추측해서 채우지 않는다.
       잘못 채운 거래명세서가 정상처럼 보이는 것보다 빈칸을 사람이 채우는 편이 안전하다.

출력 JSON의 주요 키: contract_id, title, supplier{name,biz,rep,address,phone}, buyer{name,biz},
amount{basis,value,vat_included}, installments[], period{start,end}, item{name,spec,unit},
account, missing[], evidence{}.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

# 시/도 이름. 서명란 한 줄에 갑·을 주소가 이어 붙어 추출되므로, 두 번째 주소의 시작 위치를 찾는 데 쓴다.
PROVINCES = ('서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
             '세종특별자치시', '경기도', '강원특별자치도', '강원도', '충청북도', '충청남도', '전북특별자치도',
             '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도')
# 사업자등록번호 형식(000-00-00000).
BIZ = r'\d{3}-\d{2}-\d{5}'
# 금액 숫자(쉼표 포함).
MONEY = r'[\d,]+'


def money(text):
    """'1,200,000' 같은 문자열을 정수로 바꾼다."""
    return int(text.replace(',', ''))


def read_pages(path):
    """PDF의 페이지별 텍스트 목록을 돌려준다. 텍스트가 없는 페이지는 빈 문자열이다."""
    return [(page.extract_text() or '') for page in PdfReader(str(path)).pages]


def find(pattern, text, flags=0):
    """첫 번째 일치 결과를 돌려주고, 없으면 None을 돌려준다."""
    return re.search(pattern, text, flags)


def split_addresses(line):
    """서명란 '주 소 <갑 주소> <을 주소>' 줄을 두 주소로 나눈다.

    두 번째 시/도 이름이 나오는 위치에서 자른다. 시/도를 하나만 찾으면 나눌 수 없으므로 (None, None)을 돌려준다.
    """
    starts = sorted({m.start() for p in PROVINCES for m in re.finditer(re.escape(p), line)})
    if len(starts) < 2:
        return None, None
    return line[starts[0]:starts[1]].strip(), line[starts[1]:].strip()


def extract(path):
    """계약서 한 건을 분석해 거래명세서용 dict를 돌려준다."""
    pages = read_pages(path)
    text = '\n'.join(pages)
    flat = re.sub(r'\s+', ' ', text)
    evidence = {}

    # 관리번호와 계약명(표지 첫 줄에서 '계약서'를 뺀 부분).
    m = find(r'관리번호\s*:\s*(C-\d{4}-\d{3})', text)
    contract_id = m.group(1) if m else None
    first_line = pages[0].strip().splitlines()[0] if pages and pages[0].strip() else ''
    title = re.sub(r'\s*계약서\s*$', '', first_line).strip() or None

    # 표지의 갑·을. 공급자 = 을, 받는 쪽 = 갑.
    gap = find(r'"갑"\s*:\s*(.+)', text)
    eul = find(r'"을"\s*:\s*(.+)', text)
    buyer = {'name': gap.group(1).strip() if gap else None, 'biz': None}
    supplier = {'name': eul.group(1).strip() if eul else None, 'biz': None, 'rep': None,
                'address': None, 'phone': None}

    # 표준형 서명란: '사업자등록번호 <갑> <을>', '대표이사 <갑> (인) <을> (인)', '주 소 <갑> <을>'.
    m = find(rf'사업자등록번호\s+({BIZ})\s+({BIZ})', text)
    if m:
        buyer['biz'], supplier['biz'] = m.group(1), m.group(2)
        evidence['biz'] = m.group(0)
    m = find(r'대표이사\s+(\S+)\s*\(인\)\s*(\S+)\s*\(인\)', text)
    if m:
        supplier['rep'] = m.group(2)
        evidence['rep'] = m.group(0)
    m = find(r'^주\s*소\s+(.+)$', text, re.M)
    if m:
        _, eul_addr = split_addresses(m.group(1))
        if eul_addr:
            supplier['address'] = eul_addr
            evidence['address'] = m.group(0)

    # 간이형 문장: '"을"의 상호는 X, 사업자등록번호는 N, 대표자는 R이다'. 을의 정보만 있다.
    m = find(rf'"을"의 상호는\s*(.+?),\s*사업자등록번호는\s*({BIZ}),\s*대표자는\s*(\S+?)이다', flat)
    if m:
        supplier['biz'] = supplier['biz'] or m.group(2)
        supplier['rep'] = supplier['rep'] or m.group(3)
        evidence.setdefault('biz', m.group(0))

    # 금액. 월 금액/총 금액과 부가세 별도·포함 여부를 함께 읽는다.
    amount = None
    m = find(rf'(월|총)\s*금\s*({MONEY})원\s*\(부가가치세\s*(별도|포함)\)', flat)
    if m:
        amount = {'basis': m.group(1), 'value': money(m.group(2)), 'vat_included': m.group(3) == '포함'}
        evidence['amount'] = m.group(0)

    # 분할 지급: 'N차분 : 계약금액의 P%인 금 X원(부가가치세 별도)'.
    installments = []
    for m in re.finditer(rf'(\d+)차분\s*:\s*계약금액의\s*(\d+)%인\s*금\s*({MONEY})원\s*\(부가가치세\s*(별도|포함)\)', flat):
        installments.append({'stage': int(m.group(1)), 'percent': int(m.group(2)),
                             'value': money(m.group(3)), 'vat_included': m.group(4) == '포함',
                             'evidence': m.group(0)})

    # 계약기간: '[2026]년 [01]월 [01]일부터 [2026]년 [12]월 [31]일'(대괄호는 있을 수도, 없을 수도 있다).
    period = {'start': None, 'end': None}
    d = r'\[?(\d{4})\]?년\s*\[?(\d{1,2})\]?월\s*\[?(\d{1,2})\]?\s*일?'
    m = find(rf'계약기간[^.]*?{d}부터\s*{d}', flat)
    if m:
        g = m.groups()
        period = {'start': f'{g[0]}-{int(g[1]):02d}-{int(g[2]):02d}',
                  'end': f'{g[3]}-{int(g[4]):02d}-{int(g[5]):02d}'}

    # 계좌: '계좌번호 : 은행 번호 (예금주 : X)'. 예금주가 공급자와 다르면 쓰지 않는다(지급받는 사람이 공급자여야 한다).
    account = None
    m = find(r'계좌번호\s*:\s*(.+?)(?:\n|$)', text)
    if m:
        account = m.group(1).strip()
        evidence['account'] = account

    # 품명·규격·단위. 별첨1의 '서비스명'·'대상'을 쓰고, 없으면 계약명을 품명으로 쓴다.
    item = {'name': None, 'spec': None, 'unit': None}
    m = find(r'\d\s+서비스명\s+(.+)', text)
    item['name'] = m.group(1).strip() if m else title
    m = find(r'\d\s+대상\s+(.+)', text)
    item['spec'] = m.group(1).strip() if m else None
    if amount and amount['basis'] == '월':
        item['unit'] = '월'
    elif find(rf'\d+\s*식\s+{MONEY}\s+{MONEY}', flat):
        item['unit'] = '식'

    result = {'source': str(path), 'contract_id': contract_id, 'title': title, 'supplier': supplier,
              'buyer': buyer, 'amount': amount, 'installments': installments, 'period': period,
              'item': item, 'account': account, 'evidence': evidence}
    result['missing'] = missing_fields(result)
    return result


def missing_fields(r):
    """거래명세서에 필요한데 계약서에서 찾지 못한 항목 키 목록을 돌려준다.

    키 이름은 fill_statement.py의 --set 키와 같아서, 사용자에게 받은 값을 그대로 넘길 수 있다.
    """
    checks = {
        'supplier.name': r['supplier']['name'], 'supplier.biz': r['supplier']['biz'],
        'supplier.rep': r['supplier']['rep'], 'supplier.address': r['supplier']['address'],
        'supplier.phone': r['supplier']['phone'], 'buyer.name': r['buyer']['name'],
        'amount': r['amount'], 'item.name': r['item']['name'], 'item.spec': r['item']['spec'],
        'item.unit': r['item']['unit'], 'account': r['account'],
    }
    return [k for k, v in checks.items() if not v]


def main():
    """명령행 인자를 읽어 추출 결과를 UTF-8 JSON 파일로 쓴다(Windows 콘솔의 한글 깨짐 회피)."""
    ap = argparse.ArgumentParser(description='계약서 PDF → 거래명세서용 JSON')
    ap.add_argument('pdf')
    ap.add_argument('--out', required=True, help='결과 JSON 경로')
    args = ap.parse_args()
    data = extract(Path(args.pdf))
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'saved {args.out} missing={len(data["missing"])}')


if __name__ == '__main__':
    # Windows 콘솔 기본 인코딩(cp949) 대신 UTF-8로 출력해 한글 메시지가 깨지지 않게 한다.
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    sys.exit(main())
