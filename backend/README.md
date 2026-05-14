# Learnora — AWS Bedrock Backend

## Prerequisites

- AWS CLI configured (`aws configure`)
- AWS SAM CLI installed (`pip install aws-sam-cli`)
- Bedrock model access enabled in your AWS account:
  - Go to AWS Console → Bedrock → Model access → Enable **Claude 3 Haiku**

## Deploy

```bash
cd backend
sam build
sam deploy --guided
```

Follow the prompts. When asked for stack name use `learnora-bedrock`.

After deploy, copy the **ApiUrl** from the Outputs section.

## Connect to frontend

Open `index.html` and uncomment + fill in the config line:

```html
<script>
  window.LEARNORA_API_URL = 'https://YOUR_ID.execute-api.REGION.amazonaws.com/prod';
</script>
```

## AI Features connected

| Feature | Function | Bedrock call |
|---------|----------|-------------|
| Chat — general Q&A | `ChatPage.sendMessage()` | `BedrockAI.chat()` |
| Chat — pathway generation | `ChatPage.sendMessage()` | `BedrockAI.generatePathway()` |
| Topic doubts bar | `DoubtsBar.send()` | `BedrockAI.answerDoubt()` |
| Exam short-answer eval | `TopicExam.submitAnswer()` | `BedrockAI.evaluateAnswer()` |
| Checkpoint quiz questions | `CheckpointQuiz.open()` | `BedrockAI.generateQuestions()` *(optional)* |

All features fall back to offline/static responses if Bedrock is not configured.

## Estimated cost (Claude 3 Haiku)

- Input:  $0.00025 / 1K tokens
- Output: $0.00125 / 1K tokens
- A typical chat message costs ~$0.001 (< 0.1 cent)
