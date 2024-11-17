import pandas as pd
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import CountVectorizer
import joblib
import nltk
import os

# Download required NLTK data
nltk.download("punkt")
nltk.download("stopwords")
nltk.download("wordnet")

# Step 1: Load the data
try:
    data = pd.read_csv(os.getenv("DATASET"))
    print(data.head())  # Preview the first few rows
    print("Columns:", data.columns)  # Check the column names
except Exception as e:
    print("Error loading dataset:", e)
    exit()

# Ensure the dataset contains the necessary columns
if 'text' not in data.columns or 'username' not in data.columns:
    print('Error: CSV file must contain \'text\' and \'username\' columns.')
    exit()

# Step 2: Preprocess the text data
tokenizer = word_tokenize
stop_words = stopwords.words('english')
lemmatizer = WordNetLemmatizer()
preprocessed_text = []

# Convert all text to strings and handle missing values
data['text'] = data['text'].fillna('').astype(str)

for sentence in data['text']:
    try:
        tokens = tokenizer(sentence)  # Tokenize the text
        tokens = [token for token in tokens if token.lower() not in stop_words]  # Remove stopwords
        tokens = [lemmatizer.lemmatize(token) for token in tokens]  # Lemmatize tokens
        preprocessed_text.append(' '.join(tokens))
    except Exception as e:
        print(f'Error processing sentence: {sentence}')
        print(f'Exception: {e}')
        preprocessed_text.append('')  # Add empty string for problematic rows

# Step 3: Vectorize the text data
vectorizer = CountVectorizer()
X = vectorizer.fit_transform(preprocessed_text)
y = data['username']

# Step 4: Split the data into training and testing sets
train_text, test_text, train_labels, test_labels = train_test_split(X, y, test_size=0.2, random_state=42)

# Step 5: Train a Random Forest Classifier
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(train_text, train_labels)

# Step 6: Save the model and vectorizer
joblib.dump(clf, './models/username_predictor.joblib')
joblib.dump(vectorizer, './models/vectorizer.joblib')
print('Model and vectorizer saved.')

# Step 7: Evaluate the model
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

predictions = clf.predict(test_text)
accuracy = accuracy_score(test_labels, predictions)
report = classification_report(test_labels, predictions)
matrix = confusion_matrix(test_labels, predictions)

print('Accuracy:', accuracy)
print('Classification Report:\n', report)
print('Confusion Matrix:\n', matrix)

# Step 8: Simple prediction function for new inputs
def predict_username(input_text):
    try:
        tokens = tokenizer(input_text)
        tokens = [token for token in tokens if token.lower() not in stop_words]
        tokens = [lemmatizer.lemmatize(token) for token in tokens]
        vector = vectorizer.transform([' '.join(tokens)])
        prediction = clf.predict(vector)
        return prediction[0]
    except Exception as e:
        print('Error predicting username:', e)
        return None

# Test the prediction function
def testPrediction():
    print('\nTesting prediction function:')
    testMessage = 'Hey look at this message, I wonder who it\'s from!'
    blankMessage = ' '
    predictedUser = predict_username(testMessage)
    blankMessagePrediction = predict_username(blankMessage)
    print(f'Predicted user for message "{testMessage}": {predictedUser}')
    print(f'Precicted user for blank message: {blankMessagePrediction}')

testPrediction()
