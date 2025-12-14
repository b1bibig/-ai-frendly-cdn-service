export const metadata = {
  title: "콘텐츠 및 이용정책 | app.zcxv.xyz",
};

const sections = [
  {
    heading: "허용되는 콘텐츠",
    body: ["개인 이미지/사진", "개발·SNS용 리소스", "저작권 침해가 없는 파일"],
  },
  {
    heading: "허용되지 않는 콘텐츠",
    body: [
      "음란물, 불법 촬영물, 청소년 성착취물, 과도한 폭력물, 혐오·차별 발언",
      "저작권 침해 파일 및 워터마크 제거/우회를 목적으로 한 파일",
      "주민등록번호·여권번호·금융정보 등 개인정보가 포함된 문서",
      "악성코드/실행파일, 랜섬웨어 유포용 스크립트",
      "스팸·피싱·사기, 크롤러/봇을 이용한 자동화된 대량 업로드",
      "불법 도박, 마약·총기·위조상품 판매 또는 불법 의약품 거래를 조장하는 콘텐츠",
      "법령 위반 또는 사회적 문제를 일으키는 모든 콘텐츠",
    ],
  },
  {
    heading: "조치",
    body: [
      "위반 콘텐츠는 즉시 삭제 및 접근 차단",
      "반복 위반자 또는 중대한 위반자는 계정 제한 및 해지",
      "심각한 불법 콘텐츠는 사법기관 신고 및 법적 조치가 이루어질 수 있음",
    ],
  },
];

export default function ContentPolicyPage() {
  return (
    <div className="legal-page">
      <div className="panel stack gap-lg">
        <div>
          <div className="eyebrow">app.zcxv.xyz 콘텐츠 및 이용정책</div>
          <h2 className="title">콘텐츠 및 이용정책</h2>
          <p className="muted">문의: bibigbi83@gmail.com</p>
        </div>

        <div className="stack gap-lg">
          {sections.map((section) => (
            <section key={section.heading} className="stack gap-sm">
              <h3 className="title">{section.heading}</h3>
              <ul className="legal-list">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
