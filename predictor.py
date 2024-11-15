import sys
import joblib
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

# Load the model and vectorizer
clf = joblib.load("username_predictor.joblib")
vectorizer = joblib.load("vectorizer.joblib")

# Download NLTK data (if not already available)
import nltk
nltk.download("punkt", quiet=True)
nltk.download("stopwords", quiet=True)

# Preprocessing tools
tokenizer = word_tokenize
stop_words = stopwords.words("english")
lemmatizer = WordNetLemmatizer()

# Process input text
def preprocess(text):
    tokens = tokenizer(text)
    tokens = [token for token in tokens if token.lower() not in stop_words]
    tokens = [lemmatizer.lemmatize(token) for token in tokens]
    return ' '.join(tokens)

# Get input text from Node.js
input_text = sys.argv[1]
preprocessed = preprocess(input_text)
vector = vectorizer.transform([preprocessed])
prediction = clf.predict(vector)

# Output the prediction
print(prediction[0])
