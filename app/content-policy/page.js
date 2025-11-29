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
      "음란물, 불법 촬영물, 청소년 성착취물",
      "저작권 침해 파일",
      "개인정보가 포함된 문서",
      "악성코드/실행파일",
      "자동화된 대량 업로드",
      "법령 위반 또는 사회적 문제를 일으키는 콘텐츠",
    ],
  },
  {
    heading: "조치",
    body: [
      "위반 콘텐츠는 즉시 삭제",
      "반복 위반자는 계정 제한",
      "심각한 불법 콘텐츠는 법적 조치 가능",
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
