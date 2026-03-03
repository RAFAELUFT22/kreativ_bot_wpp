import frappe
import json
import sys
import re

def create_full_course(course_data):
    """
    Cria um curso completo no Frappe LMS.
    Versão 4.0: Integração profunda com blocos nativos (Quiz e Assignment).
    """
    try:
        # 1. Criar o Curso
        course = frappe.new_doc("LMS Course")
        course.title = str(course_data.get("title"))
        course.description = course_data.get("description")
        course.short_introduction = course_data.get("short_intro", course.title)
        course.published = 1
        course.paid_course = 0
        course.enable_certification = 1
        
        course.append("instructors", {"instructor": "Administrator"})
        course.insert()
        frappe.db.commit()
        print(f"✅ Curso '{course.title}' criado.")

        create_approval_batch(course.name, course.title)

        is_first_lesson = True

        for chap_data in course_data.get("chapters", []):
            # 2. Criar Capítulo
            chapter = frappe.new_doc("Course Chapter")
            chapter.title = str(chap_data.get("title"))
            chapter.course = course.name
            chapter.published = 1
            chapter.insert()
            
            # Registrar capítulo no curso
            course = frappe.get_doc("LMS Course", course.name)
            course.append("chapters", {"chapter": chapter.name})
            course.save()
            frappe.db.commit()

            for lesson_data in chap_data.get("lessons", []):
                # 3. Criar Lição
                lesson = frappe.new_doc("Course Lesson")
                lesson.title = str(lesson_data.get("title"))
                lesson.course = course.name
                lesson.chapter = chapter.name
                
                if is_first_lesson:
                    lesson.include_in_preview = 1
                    is_first_lesson = False
                
                raw_text = str(lesson_data.get("content", ""))
                lesson.body = raw_text
                
                # Parsear blocos básicos
                blocks = parse_markdown_to_blocks(raw_text)
                
                # Setup do tipo de lição
                youtube_match = re.search(r'(https?://(?:www\.)?youtu(?:be\.com/watch\?v=|\.be/)([\w\-]+))', raw_text)
                if youtube_match:
                    lesson.lesson_type = "Video"
                    lesson.youtube = youtube_match.group(1)
                elif raw_text.lower().endswith(".pdf"):
                    lesson.lesson_type = "PDF"
                else:
                    lesson.lesson_type = "Article"
                
                # Gerenciar Quiz Nativo
                quiz_data = lesson_data.get("quiz")
                if quiz_data:
                    quiz = create_quiz(quiz_data, course.name)
                    lesson.quiz = quiz.name
                    # Injetar bloco do Quiz nativo
                    blocks.append({
                        "type": "quiz",
                        "data": {"quiz": quiz.name}
                    })
                
                # Gerenciar Assignment Nativo
                assignment_data = lesson_data.get("assignment")
                if assignment_data:
                    assignment = create_assignment(assignment_data, course.name)
                    # Injetar bloco do Assignment nativo
                    blocks.append({
                        "type": "assignment",
                        "data": {"assignment": assignment.name}
                    })

                lesson.content = json.dumps({"blocks": blocks})
                lesson.insert()
                
                # Vincular ao Capítulo
                chapter = frappe.get_doc("Course Chapter", chapter.name)
                chapter.append("lessons", { "lesson": lesson.name })
                chapter.save()
                frappe.db.commit()
                print(f"    📖 Lição '{lesson.title}' injetada ({len(blocks)} blocos nativos).")

        print(f"\n🚀 Pipeline v4.0 concluído! Link: /courses/{course.name}")
        return course.name

    except Exception as e:
        frappe.db.rollback()
        print(f"❌ Erro: {str(e)}")
        raise e

def parse_markdown_to_blocks(text):
    blocks = []
    lines = text.split("\n")
    in_code = False
    code_content = []
    
    for line in lines:
        line = line.strip()
        if not line and not in_code: continue
        
        if line.startswith("```"):
            if in_code:
                blocks.append({"type": "code", "data": {"code": "\n".join(code_content)}})
                code_content = []
                in_code = False
            else:
                in_code = True
            continue
        if in_code:
            code_content.append(line)
            continue

        if line.startswith("### "):
            blocks.append({"type": "header", "data": {"text": line[4:], "level": 3}})
        elif line.startswith("## "):
            blocks.append({"type": "header", "data": {"text": line[3:], "level": 2}})
        elif "|" in line and "-|-" not in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if not blocks or blocks[-1]['type'] != 'table':
                blocks.append({"type": "table", "data": {"content": [parts]}})
            else:
                blocks[-1]['data']['content'].append(parts)
        elif line.startswith("- ") or line.startswith("* "):
            if not blocks or blocks[-1]['type'] != 'list':
                blocks.append({"type": "list", "data": {"style": "unordered", "items": [line[2:]]}})
            else:
                blocks[-1]['data']['items'].append(line[2:])
        else:
            blocks.append({"type": "paragraph", "data": {"text": line}})
            
    return blocks

def create_approval_batch(course_name, course_title):
    try:
        batch = frappe.new_doc("LMS Batch")
        batch.batch_name = f"Inscrição — {str(course_title)}"[:140]
        batch.course = course_name
        batch.published = 1
        batch.allow_self_enrollment = 0
        batch.insert()
        frappe.db.commit()
    except:
        pass

def create_assignment(assignment_data, course_name):
    """Cria um DocType LMS Assignment."""
    assignment = frappe.new_doc("LMS Assignment")
    assignment.title = f"{str(assignment_data.get('title'))} ({course_name[-6:]})"
    assignment.course = course_name
    assignment.type = assignment_data.get("type", "Document") # Pode ser PDF, URL, Text
    assignment.question = assignment_data.get("question", "Envie seu trabalho.")
    assignment.insert()
    return assignment

def create_quiz(quiz_data, course_name):
    quiz = frappe.new_doc("LMS Quiz")
    quiz.title = f"{str(quiz_data.get('title'))} ({course_name[-6:]})"
    quiz.course = course_name
    quiz.passing_percentage = quiz_data.get("passing_score", 70)
    quiz.insert()
    
    for q in quiz_data.get("questions", []):
        lms_question = frappe.new_doc("LMS Question")
        lms_question.question = q.get("question")
        lms_question.type = "Choices"
        options = q.get("options", [])
        for i, opt in enumerate(options[:4], 1):
            setattr(lms_question, f"option_{i}", opt)
            if opt == q.get("answer"):
                setattr(lms_question, f"is_correct_{i}", 1)
        lms_question.insert()
        
        quiz = frappe.get_doc("LMS Quiz", quiz.name)
        quiz.append("questions", {"question": lms_question.name, "marks": 1})
        quiz.save()
        frappe.db.commit()
    
    return quiz

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    data = json.loads(sys.argv[1])
    create_full_course(data)
